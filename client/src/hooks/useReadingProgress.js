import { useEffect, useState, useRef } from 'react';

/**
 * Tracks scroll position as a 0–1 reading progress value.
 * Attaches to window scroll for full-page reader layouts.
 */
export function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    function update() {
      const docH   = document.documentElement.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      setProgress(docH > 0 ? Math.min(1, scrollY / docH) : 0);
    }

    function onScroll() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // initial
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return progress;
}
