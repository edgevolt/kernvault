import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  function handleStart() {
    localStorage.setItem('onboarding_complete', 'true');
    navigate('/spaces/new');
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="max-w-sm w-full text-center space-y-10">

        {/* Wordmark */}
        <div>
          <span className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Kernvault
          </span>
        </div>

        {/* Philosophy statement */}
        <div className="space-y-4 text-left">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Kernvault is built around a simple idea: you don't truly know something until you can explain it.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Every Space starts with why the topic matters to you. Every item ends with you proving you understood it.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            The tool does the rest.
          </p>
        </div>

        {/* Three core concepts */}
        <div className="space-y-3 text-left border-t border-zinc-200 dark:border-zinc-800 pt-8">
          <div className="flex gap-3 items-start">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 w-12 pt-0.5 shrink-0">Space</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">A topic you want to learn, anchored by your intent.</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 w-12 pt-0.5 shrink-0">Stage</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">A chapter within that Space — a natural grouping of material.</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-600 w-12 pt-0.5 shrink-0">Item</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">A single piece of content — article, video, PDF, or text.</span>
          </div>
        </div>

        {/* CTA */}
        <button
          className="btn-primary w-full py-3 text-base"
          onClick={handleStart}
          id="welcome-create-space"
        >
          Create my first Space
        </button>
      </div>
    </div>
  );
}
