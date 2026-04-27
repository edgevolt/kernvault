import { useEffect, useRef, useState } from 'react';

/**
 * Hook for Web Speech API voice transcription.
 * - No audio stored; transcription is ephemeral until saved.
 * - Gracefully degrades if API is unsupported.
 */
export function useVoiceInput({ onTranscript } = {}) {
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const recogRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function start() {
    if (!supported || listening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.lang = navigator.language || 'en-US';

    recog.onresult = (e) => {
      const results = Array.from(e.results).slice(e.resultIndex);
      const text = results
        .filter(r => r.isFinal)
        .map(r => r[0].transcript.trim())
        .join(' ');
      if (text) {
        setTranscript(t => t + (t ? ' ' : '') + text);
        onTranscript?.(text);
      }
    };

    recog.onerror = () => {
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
    };

    // Auto-stop after 60 seconds
    const timeout = setTimeout(() => recog.stop(), 60_000);
    recog.onend = () => {
      clearTimeout(timeout);
      setListening(false);
    };

    recogRef.current = recog;
    recog.start();
    setListening(true);
    setTranscript('');
  }

  function stop() {
    recogRef.current?.stop();
    setListening(false);
  }

  useEffect(() => {
    return () => recogRef.current?.stop();
  }, []);

  return { listening, supported, transcript, start, stop };
}
