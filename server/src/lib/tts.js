/**
 * Local, privacy-preserving text-to-speech engine.
 *
 * Runs a small neural model (Kokoro-82M) IN-PROCESS on the host CPU. No article
 * text or audio ever leaves the machine: the model is loaded from a vendored
 * local path with remote model fetching disabled, so nothing is requested from
 * Hugging Face, a CDN, or any third party.
 *
 * The whole feature is gated by TTS_ENABLED. When it is off — or the model files
 * are not vendored, or the (optional) dependencies are not installed — the engine
 * reports `enabled: false` and the server runs normally without it. kokoro-js and
 * @huggingface/transformers are ESM-only, so they are pulled in via dynamic
 * import() and only when the model is actually needed.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { DATA_DIR } = require('../db');

// Capability is AVAILABLE by default when the model is baked into the image.
// `TTS_ENABLED=false` is an operator hard-off override for low-power hosts.
// (Whether read-aloud actually runs is a separate per-user in-app toggle.)
const OPERATOR_DISABLED = process.env.TTS_ENABLED === 'false';
const MODEL_ID      = process.env.TTS_MODEL_ID || 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_DTYPE   = process.env.TTS_MODEL_DTYPE || 'fp32'; // fp32 default: int8 (q8) is emulated/slow on CPUs without AVX-512/VNNI
const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.TTS_MAX_CONCURRENCY || '1', 10));
// Directory that CONTAINS the `<MODEL_ID>` folder (transformers.js resolves
// `${localModelPath}/${MODEL_ID}`). Vendor the model there in the image.
const MODELS_DIR    = process.env.TTS_MODELS_DIR || path.join(__dirname, '../../models');
const CACHE_DIR     = path.join(DATA_DIR, 'tts-cache');
const MODEL_VERSION = `${MODEL_ID}@${MODEL_DTYPE}`;
const MAX_TEXT_LEN  = 5000;

// Curated voice list (id + friendly label). The server validates requests
// against this and falls back to the default; the client renders the labels.
const VOICES = [
  { id: 'af_heart',   label: 'Heart · US Female' },
  { id: 'af_bella',   label: 'Bella · US Female' },
  { id: 'af_nicole',  label: 'Nicole · US Female' },
  { id: 'am_michael', label: 'Michael · US Male' },
  { id: 'am_fenrir',  label: 'Fenrir · US Male' },
  { id: 'bf_emma',    label: 'Emma · UK Female' },
  { id: 'bm_george',  label: 'George · UK Male' },
];
const VOICE_IDS = new Set(VOICES.map(v => v.id));
const DEFAULT_VOICE = 'af_heart';

let ttsPromise = null; // cached model-load promise
let loadFailed = false;

function modelPresent() {
  try {
    return fs.existsSync(path.join(MODELS_DIR, MODEL_ID));
  } catch {
    return false;
  }
}

function getStatus() {
  return {
    // `enabled` here means "available on this host" (capability), not "playing".
    enabled: !OPERATOR_DISABLED && modelPresent() && !loadFailed,
    voices: VOICES,
    defaultVoice: DEFAULT_VOICE,
  };
}

function clampRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(2.0, Math.max(0.5, n));
}

// ─── Concurrency guard ────────────────────────────────────────────────────────
// Serialize (or lightly bound) synthesis so a single CPU host isn't overwhelmed.
let active = 0;
const queue = [];
function acquire() {
  return new Promise((resolve) => {
    const tryRun = () => {
      if (active < MAX_CONCURRENCY) { active++; resolve(); }
      else queue.push(tryRun);
    };
    tryRun();
  });
}
function release() {
  active = Math.max(0, active - 1);
  const next = queue.shift();
  if (next) next();
}

// Report whether the native onnxruntime-node binding is actually loadable. If it
// is NOT, @huggingface/transformers silently falls back to the single-threaded
// WASM backend — which is 10-30x slower and is the classic cause of multi-second
// per-chunk synthesis on an otherwise-idle multicore host. We log this loudly so
// "silently slow" can never happen unnoticed again.
function probeNativeBackend() {
  try {
    const ort = require('onnxruntime-node');
    return { native: typeof ort.InferenceSession === 'function', version: ort.version || 'unknown', error: null };
  } catch (err) {
    return { native: false, version: null, error: err.message };
  }
}

async function loadModel() {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    const t0 = Date.now();
    const { KokoroTTS } = await import('kokoro-js');
    const { env } = await import('@huggingface/transformers');
    // Privacy invariant: never touch the network. Load only vendored local files.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = MODELS_DIR;
    const model = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, device: 'cpu' });

    const backend = probeNativeBackend();
    const cores = os.cpus().length;
    console.log(`[tts] model loaded in ${Date.now() - t0}ms (dtype=${MODEL_DTYPE}, cores=${cores})`);
    if (backend.native) {
      console.log(`[tts] ONNX backend: native onnxruntime-node v${backend.version} (uses all ${cores} cores)`);
    } else {
      console.warn(
        `[tts] WARNING: native onnxruntime-node did NOT load (${backend.error}). ` +
        `Synthesis is likely running on the single-threaded WASM backend and will be very slow. ` +
        `Ensure onnxruntime-node and its runtime libs (e.g. libgomp1) are present in the image.`
      );
    }
    return model;
  })().catch((err) => {
    loadFailed = true;
    ttsPromise = null;
    throw err;
  });
  return ttsPromise;
}

// Eagerly load the model (and warm the inference path with one tiny throwaway
// synthesis) so the first real request doesn't pay the cold-start cost. Safe to
// call repeatedly/concurrently: the model load is memoized and the warm synth
// runs at most once. No-op when TTS is unavailable on this host.
let warmedPromise = null;
function warmup() {
  if (OPERATOR_DISABLED || !modelPresent() || loadFailed) return Promise.resolve();
  if (warmedPromise) return warmedPromise;
  warmedPromise = (async () => {
    const tts = await loadModel();
    await tts.generate('Warming up.', { voice: DEFAULT_VOICE, speed: 1.0 });
    console.log('[tts] warmup complete — model ready.');
  })().catch((err) => {
    warmedPromise = null; // allow a retry on the next trigger
    console.warn('[tts] warmup failed:', err.message);
  });
  return warmedPromise;
}

function cachePath(text, voice, speed) {
  const hash = crypto
    .createHash('sha256')
    .update(`${MODEL_VERSION}|${voice}|${speed}|${text}`)
    .digest('hex');
  return path.join(CACHE_DIR, `${hash}.wav`);
}

/**
 * Synthesize `text` to a WAV Buffer. Results are cached on disk in the data
 * volume, keyed by model version + voice + rate + text, so re-listens (and
 * popular content) are synthesized only once. The cache is always safe to delete.
 */
async function synthesize(text, { voice, rate } = {}) {
  const v = VOICE_IDS.has(voice) ? voice : DEFAULT_VOICE;
  const speed = clampRate(rate);
  const cp = cachePath(text, v, speed);

  try {
    if (fs.existsSync(cp)) {
      console.log(`[tts] cache hit (${text.length} chars)`);
      return await fs.promises.readFile(cp);
    }
  } catch { /* fall through to synthesize */ }

  await acquire();
  try {
    const tts = await loadModel();
    const t0 = Date.now();
    const audio = await tts.generate(text, { voice: v, speed });
    const wav = Buffer.from(audio.toWav());
    // Real-time factor = synthesis wall time / produced audio duration. RTF < 1
    // means faster than realtime (good); RTF >> 1 means playback will stall.
    const ms = Date.now() - t0;
    const audioSec = audio.audio?.length && audio.sampling_rate
      ? audio.audio.length / audio.sampling_rate
      : 0;
    const rtf = audioSec > 0 ? (ms / 1000 / audioSec).toFixed(2) : '?';
    console.log(`[tts] synth ${text.length} chars in ${ms}ms (${audioSec.toFixed(1)}s audio, RTF ${rtf})`);
    // Best-effort cache write; never block the response on it.
    fs.promises
      .mkdir(CACHE_DIR, { recursive: true })
      .then(() => fs.promises.writeFile(cp, wav))
      .catch(() => {});
    return wav;
  } finally {
    release();
  }
}

module.exports = { getStatus, synthesize, warmup, MAX_TEXT_LEN };
