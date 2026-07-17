import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Read-aloud hook backed by the local server-side TTS engine (`/api/tts`).
 *
 * Audio is generated one sentence at a time and the next sentence is pre-fetched
 * while the current one plays, so latency is hidden and the active sentence index
 * can drive read-along highlighting. Everything is local: audio comes only from
 * Kernvault's own origin. Mirrors the graceful-degradation shape of useVoiceInput.
 *
 * @param {object}   opts
 * @param {Array}    opts.sentences  Ordered sentences (strings or {text} objects).
 * @param {string}   opts.voice      Voice id.
 * @param {number}   opts.rate       Speed (0.5–2.0).
 * @param {function} opts.onIndexChange  Called with the sentence index now speaking (or -1).
 */
export function useTextToSpeech({ sentences = [], voice, rate, onIndexChange } = {}) {
  const [available, setAvailable] = useState(false); // server capability (from /api/tts/status)
  const [voices, setVoices]   = useState([]);
  const [status, setStatus]   = useState('idle'); // idle | loading | speaking | paused | error
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Latest props, read inside async callbacks without re-creating them.
  const propsRef = useRef({});
  propsRef.current = { sentences, voice, rate, onIndexChange };

  // One reusable <audio> element.
  const audioRef = useRef(null);
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
  }

  // Blob-URL cache for synthesized sentences; invalidated when voice/rate change.
  const cacheRef    = useRef(new Map()); // index(string) -> objectURL
  const cacheSigRef = useRef('');
  const runRef      = useRef(0);         // bumped on stop/restart to void stale async

  const clearCache = useCallback(() => {
    for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
    cacheRef.current.clear();
  }, []);

  const setIndex = useCallback((i) => {
    setCurrentIndex(i);
    propsRef.current.onIndexChange?.(i);
  }, []);

  // Availability check (also yields the voice list).
  useEffect(() => {
    let alive = true;
    api.getTtsStatus()
      .then((s) => { if (alive) { setAvailable(!!s.enabled); setVoices(s.voices || []); } })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  const ensureAudio = useCallback(async (i) => {
    const { sentences: sents, voice: v, rate: r } = propsRef.current;
    if (i < 0 || i >= sents.length) return null;

    const sig = `${v}|${r}`;
    if (cacheSigRef.current !== sig) { clearCache(); cacheSigRef.current = sig; }

    const key = String(i);
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    const raw = sents[i];
    const text = (typeof raw === 'string' ? raw : raw?.text || '').trim();
    if (!text) return null;

    const blob = await api.synthesizeTts({ text, voice: v, rate: r });
    // A newer voice/rate may have won the race while we awaited; drop this result.
    if (cacheSigRef.current !== sig) return null;
    const url = URL.createObjectURL(blob);
    cacheRef.current.set(key, url);
    return url;
  }, [clearCache]);

  const stop = useCallback(() => {
    runRef.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.removeAttribute('src');
      try { audio.load(); } catch { /* noop */ }
    }
    setStatus('idle');
    setIndex(-1);
  }, [setIndex]);

  const playFrom = useCallback((start) => {
    const audio = audioRef.current;
    if (!audio) return;
    const run = ++runRef.current;

    const step = async (i) => {
      const { sentences: sents } = propsRef.current;
      if (run !== runRef.current) return;               // superseded
      if (i < 0 || i >= sents.length) { stop(); return; } // finished

      setIndex(i);
      setStatus('loading');

      let url;
      try {
        url = await ensureAudio(i);
      } catch {
        if (run === runRef.current) setStatus('error');
        return;
      }
      if (run !== runRef.current) return;
      if (!url) { step(i + 1); return; }                // skip empty/anchor-only

      audio.src = url;
      audio.onended = () => { if (run === runRef.current) step(i + 1); };
      try {
        await audio.play();
        if (run === runRef.current) setStatus('speaking');
      } catch {
        // Autoplay blocked etc. — leave in loading; user can retry.
      }
      // Warm the next sentence so playback stays ahead.
      ensureAudio(i + 1).catch(() => {});
    };

    step(start);
  }, [ensureAudio, stop, setIndex]);

  const play = useCallback(() => {
    if (status === 'paused') {
      audioRef.current?.play().then(() => setStatus('speaking')).catch(() => {});
      return;
    }
    playFrom(currentIndex >= 0 ? currentIndex : 0);
  }, [status, currentIndex, playFrom]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus('paused');
  }, []);

  const next = useCallback(() => playFrom((currentIndex < 0 ? 0 : currentIndex) + 1), [currentIndex, playFrom]);
  const prev = useCallback(() => playFrom(Math.max(0, (currentIndex < 0 ? 0 : currentIndex) - 1)), [currentIndex, playFrom]);
  const seekTo = useCallback((i) => playFrom(i), [playFrom]);

  // Reset when the source sentences change (e.g. switching articles).
  useEffect(() => {
    stop();
    clearCache();
    cacheSigRef.current = '';
  }, [sentences, stop, clearCache]);

  // Cleanup on unmount.
  useEffect(() => () => { stop(); clearCache(); }, [stop, clearCache]);

  return {
    available,
    voices,
    status,
    currentIndex,
    isPlaying: status === 'speaking' || status === 'loading',
    play,
    pause,
    stop,
    next,
    prev,
    seekTo,
  };
}
