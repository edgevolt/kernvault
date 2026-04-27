import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar';

export default function SpaceCard({ space }) {
  const total = Number(space.total_items) || 0;
  const done  = Number(space.done_items)  || 0;
  const ratio = total > 0 ? done / total : 0;

  return (
    <Link
      to={`/spaces/${space.id}`}
      className="card block p-5 sm:p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors duration-150 group animate-fade-in"
      aria-label={`Open space: ${space.name}`}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
          {space.name}
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0 mt-0.5">
          {done}/{total}
        </span>
      </div>

      {space.intent && (
        <p className="text-sm text-zinc-500 dark:text-zinc-500 line-clamp-1 mb-4 italic">
          {space.intent}
        </p>
      )}

      <ProgressBar value={ratio} size="xs" />
    </Link>
  );
}
