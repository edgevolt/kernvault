// ─── FirstUseOverlay.jsx ──────────────────────────────────────────────────────
// Shown once per Space on first Synthesis canvas mount.

export function FirstUseOverlay({ onDismiss }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
        <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
          ✦
        </div>
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">
          This is your thinking space
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
          Pull anything you've learned onto the canvas and connect the dots.
        </p>
        <button
          onClick={onDismiss}
          className="btn-primary w-full"
          autoFocus
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ─── SynthesisToolbar.jsx ─────────────────────────────────────────────────────
// Thin floating toolbar at the top of the Synthesis canvas.

export function SynthesisToolbar({ ghostVisible, onGhostToggle, zoom, onZoomReset }) {
  return (
    <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
      {/* Ghost layer toggle */}
      <button
        onClick={onGhostToggle}
        title={ghostVisible ? 'Hide structure overlay' : 'Show structure overlay'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest transition-colors border shadow-sm
          ${ghostVisible
            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'
            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600'}`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {ghostVisible
            ? <><path d="M12 5a7 7 0 0 1 7 7"/><path d="M12 5a7 7 0 0 0-7 7"/><path d="M5 12a7 7 0 0 0 7 7"/><path d="M12 19a7 7 0 0 0 7-7"/></>
            : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></>
          }
        </svg>
        {ghostVisible ? 'Hide structure' : 'Show structure'}
      </button>

      {/* Zoom reset */}
      <button
        onClick={onZoomReset}
        title="Reset zoom to 100%"
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 transition-colors shadow-sm"
      >
        {Math.round(zoom * 100)}%
        {zoom !== 1 && <span className="text-zinc-400 ml-0.5">↺</span>}
      </button>
    </div>
  );
}
