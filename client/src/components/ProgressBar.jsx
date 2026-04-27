export default function ProgressBar({ value = 0, size = 'sm', className = '' }) {
  const heights = { xs: 'h-0.5', sm: 'h-1', md: 'h-1.5' };
  const h = heights[size] || 'h-1';
  const pct = Math.min(100, Math.max(0, value * 100));

  return (
    <div className={`progress-bar-track ${h} ${className}`} role="progressbar"
         aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
