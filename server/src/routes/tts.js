const express = require('express');
const engine = require('../lib/tts');

const router = express.Router();

// Availability + voice list. Drives whether the client shows the read-aloud UI.
router.get('/tts/status', (req, res) => {
  res.json(engine.getStatus());
});

// Kick off model load + inference warmup in the background so the first real
// synthesis doesn't pay the cold-start cost. Fire-and-forget: respond immediately.
router.post('/tts/warmup', (req, res) => {
  if (!engine.getStatus().enabled) {
    return res.status(503).json({ error: 'Text-to-speech is not enabled on this server.' });
  }
  engine.warmup(); // memoized; never awaited here
  res.status(202).json({ warming: true });
});

// Synthesize one chunk of text (typically a sentence) to WAV audio, in-process.
router.post('/tts', async (req, res) => {
  if (!engine.getStatus().enabled) {
    return res.status(503).json({ error: 'Text-to-speech is not enabled on this server.' });
  }

  const { text, voice, rate } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }
  if (text.length > engine.MAX_TEXT_LEN) {
    return res.status(400).json({ error: `text exceeds ${engine.MAX_TEXT_LEN} characters.` });
  }

  try {
    const wav = await engine.synthesize(text, { voice, rate });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  } catch (err) {
    console.error('TTS synthesis failed:', err.message);
    res.status(500).json({ error: 'Failed to synthesize audio.' });
  }
});

module.exports = router;
