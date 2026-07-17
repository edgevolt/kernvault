#!/usr/bin/env node
/**
 * Build-time fetch of the local read-aloud TTS model.
 *
 * Downloads exactly the files needed for the configured dtype from a pinned
 * Hugging Face revision, into `<out>/<model_id>/…`, and verifies the integrity
 * of every large (LFS) file against the sha256 the Hub reports for that revision.
 * Run inside a dedicated Docker build stage; the result is COPYed into the image
 * so the shipped image is self-contained. At runtime nothing is fetched
 * (`allowRemoteModels = false`).
 *
 * Usage:
 *   node fetch-model.mjs --out ./out --id <repo> --revision <rev> --dtype q8 [--skip]
 *
 * `--skip` (or SKIP_TTS_MODEL=1) creates an empty output dir and exits 0, so a
 * lean image can be built without the model (read-aloud then reports disabled).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip') out.skip = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ID    = args.id || 'onnx-community/Kokoro-82M-v1.0-ONNX';
// Pin to an immutable commit SHA (not a mutable tag like `main`) so builds are
// reproducible and the sha256 checks below verify a known snapshot.
const REV   = args.revision || '1939ad2a8e416c0acfeecc08a694d14ef25f2231';
const DTYPE = args.dtype || 'q8';
const OUT   = args.out || './out';
const SKIP  = args.skip || process.env.SKIP_TTS_MODEL === '1' || process.env.SKIP_TTS_MODEL === 'true';
const HF    = process.env.HF_ENDPOINT || 'https://huggingface.co';

// transformers.js dtype → onnx filename suffix (must match the runtime dtype).
const DTYPE_SUFFIX = {
  fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_quantized',
  uint8: '_uint8', q4: '_q4', q4f16: '_q4f16', bnb4: '_bnb4',
};
const suffix = DTYPE_SUFFIX[DTYPE] ?? '_quantized';
const wantedOnnx = `onnx/model${suffix}.onnx`;

// Keep only what the engine needs: the chosen onnx graph, all voices, and the
// small config/tokenizer JSON/txt files. Skip other dtype variants and assets.
function wanted(path) {
  if (path.startsWith('onnx/')) return path === wantedOnnx || path === `${wantedOnnx}_data`;
  if (path.startsWith('voices/')) return true;
  return /\.(json|txt)$/.test(path) && !path.includes('/');
}

// Defense-in-depth: reject any repo path that could escape the output directory,
// even though the source repo is trusted and pinned. Only safe relative paths pass.
function safePath(path) {
  if (typeof path !== 'string' || path === '') return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  return !path.split('/').some((seg) => seg === '..' || seg === '');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function sha256(file) {
  const hash = createHash('sha256');
  hash.update(await readFile(file));
  return hash.digest('hex');
}

// Git blob SHA1 = sha1("blob <bytelen>\0" + content). Lets us verify the small
// non-LFS files (config/tokenizer) against the `oid` the Hub reports for the
// pinned commit, so nothing is trusted unverified.
async function gitBlobSha1(file) {
  const data = await readFile(file);
  const hash = createHash('sha1');
  hash.update(`blob ${data.length}\0`);
  hash.update(data);
  return hash.digest('hex');
}

async function main() {
  const modelRoot = join(OUT, ID);
  await mkdir(modelRoot, { recursive: true });

  if (SKIP) {
    console.log('[fetch-model] SKIP requested — no model downloaded (read-aloud will report disabled).');
    return;
  }

  console.log(`[fetch-model] ${ID}@${REV} dtype=${DTYPE} → ${modelRoot}`);
  const tree = await fetchJson(`${HF}/api/models/${ID}/tree/${REV}?recursive=true`);
  const files = tree.filter((e) => e.type === 'file' && wanted(e.path));

  const unsafe = files.find((f) => !safePath(f.path));
  if (unsafe) throw new Error(`Refusing unsafe path from repo tree: ${unsafe.path}`);

  if (!files.some((f) => f.path === wantedOnnx)) {
    throw new Error(`Expected onnx file "${wantedOnnx}" not found at ${ID}@${REV}. ` +
      `Check the dtype (${DTYPE}) and revision.`);
  }

  const manifest = { id: ID, revision: REV, dtype: DTYPE, fetchedAt: new Date().toISOString(), files: [] };
  for (const f of files) {
    const dest = join(modelRoot, f.path);
    const url = `${HF}/${ID}/resolve/${REV}/${f.path}`;
    process.stdout.write(`[fetch-model]  ↓ ${f.path} … `);
    await download(url, dest);
    if (f.lfs?.oid) {
      // Large binaries (model + voices): verify sha256 against the LFS pointer.
      const actual = await sha256(dest);
      if (actual !== f.lfs.oid) throw new Error(`sha256 mismatch for ${f.path}: got ${actual}, expected ${f.lfs.oid}`);
      console.log('ok (sha256 verified)');
      manifest.files.push({ path: f.path, size: f.size, sha256: f.lfs.oid });
    } else if (f.oid) {
      // Small files (config/tokenizer): verify the git blob SHA1 of the commit.
      const actual = await gitBlobSha1(dest);
      if (actual !== f.oid) throw new Error(`git blob sha1 mismatch for ${f.path}: got ${actual}, expected ${f.oid}`);
      console.log('ok (git-sha1 verified)');
      manifest.files.push({ path: f.path, size: f.size, gitSha1: f.oid });
    } else {
      // No integrity value available for this file — fail closed rather than trust it.
      throw new Error(`No oid/lfs hash reported for ${f.path}; refusing to bake in an unverifiable file.`);
    }
  }

  await writeFile(join(modelRoot, 'kernvault-model-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[fetch-model] done — ${files.length} files.`);
}

main().catch((err) => {
  console.error(`[fetch-model] FAILED: ${err.message}`);
  process.exit(1);
});
