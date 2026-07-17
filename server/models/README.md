# Local TTS model (read-aloud)

Kernvault's **read-aloud** feature runs a small neural text-to-speech model
(Kokoro-82M) **in-process on the host CPU**. It is fully local and private — no
article text or audio is ever sent to a third party. It is **available by default**
when the model is present (it is, in the Docker image); each user turns it on
per-browser with the **Read aloud** switch in the reader, and operators can
hard-disable it server-wide with `TTS_ENABLED=false`.

The model files are **not** committed to this repo (they're ~80–170 MB).

## Docker (the normal path) — nothing to do

The official Docker image **already contains the model**: the build fetches and
sha256-verifies it (see the `model-fetch` stage in the [Dockerfile](../../Dockerfile),
which runs [`scripts/fetch-model.mjs`](../scripts/fetch-model.mjs)). As an admin you
do **not** vendor anything — read-aloud is available out of the box, and each user
turns it on with the **Read aloud** switch in the reader's display (Aa) menu. Set
`TTS_ENABLED=false` only if you want to hard-disable it server-wide.

Build-time knobs (maintainers, via `--build-arg`):

| Build arg | Default | Purpose |
|-----------|---------|---------|
| `TTS_MODEL_ID` | `onnx-community/Kokoro-82M-v1.0-ONNX` | Model repo to fetch. |
| `TTS_MODEL_REVISION` | `main` | **Pin to a commit** for reproducible builds. |
| `TTS_MODEL_DTYPE` | `q8` | Quantization variant to download + run. |
| `SKIP_TTS_MODEL` | *(unset)* | Set to `1` to build a lean image without the model. |

## Manual layout (local development without Docker only)

If you run the server directly (not via Docker) and want read-aloud, place the files
here yourself — or just run the fetch script:

```bash
node server/scripts/fetch-model.mjs --out server/models
```

The expected on-disk layout is:

`transformers.js` resolves a model at `<localModelPath>/<MODEL_ID>`. The engine
uses `localModelPath = server/models` and
`MODEL_ID = onnx-community/Kokoro-82M-v1.0-ONNX`, so the files must live at:

```
server/models/
└── onnx-community/
    └── Kokoro-82M-v1.0-ONNX/
        ├── config.json
        ├── tokenizer.json          (and other config/tokenizer files)
        ├── onnx/
        │   └── model_quantized.onnx   (int8 — matches TTS_MODEL_DTYPE=q8)
        └── voices/                     (per-voice .bin files)
```

Download the files from the model repo on Hugging Face
(`onnx-community/Kokoro-82M-v1.0-ONNX`) on a machine with internet access and copy
them into the layout above. Nothing is fetched at runtime — the engine sets
`allowRemoteModels = false`.

## Is this model file safe?

The widely-reported "malicious code in a model" attacks target **pickle-format**
weights (PyTorch `.bin`/`.pt`/`.ckpt`), which execute arbitrary code on load. This
setup avoids that class of risk:

- The files are **ONNX** (a protobuf *data* graph) and raw tensor voice files —
  parsed as data by the ONNX runtime, **not** deserialized as Python pickle. The
  engine runs under Node/JS (`@huggingface/transformers`), so there is no pickle
  load path at all.
- **Nothing is fetched at runtime** (`allowRemoteModels = false`). Hugging Face is a
  one-time download source you control, not a live dependency.

The build already does most of this: `fetch-model.mjs` downloads from a pinned
revision and **verifies each large file's sha256** against the value the Hugging Face
Hub reports for that revision (build fails on mismatch). Recommended extra hygiene:

1. Set `TTS_MODEL_REVISION` to a specific **commit** (not `main`) for reproducibility.
2. Optionally scan the fetched `.onnx` file with a model-security scanner.

## Turning it on

- **Docker:** nothing to do — the model is in the image, so `GET /api/tts/status` reports
  `{ "enabled": true }` (available). Each user then flips the **Read aloud** switch in the
  reader's display (Aa) menu to actually use it.
- **Local dev:** run the fetch script (above) so the files exist under `server/models`; the
  feature is then available and the in-app switch controls it.
- To hard-disable server-wide (e.g. low-power host): set `TTS_ENABLED=false`.

## Config (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `TTS_ENABLED` | *(unset = available)* | Set to `false` to hard-disable read-aloud server-wide. |
| `TTS_MODEL_ID` | `onnx-community/Kokoro-82M-v1.0-ONNX` | Model folder under `server/models`. |
| `TTS_MODEL_DTYPE` | `q8` | Quantization (`q8` int8 = low RAM/CPU; `fp32` = larger/slower). |
| `TTS_MODELS_DIR` | `server/models` | Local model root (`localModelPath`). |
| `TTS_MAX_CONCURRENCY` | `1` | Max concurrent synthesis on the host CPU. |

Synthesized audio is cached under the data volume (`data/tts-cache/`), keyed by
model version + voice + rate + text, so re-listens are instant. The cache is
regenerable and always safe to delete.
