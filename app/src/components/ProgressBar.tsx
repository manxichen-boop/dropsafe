export function ProgressBar({ current, target, tone = "bg-mint" }: { current: number; target: number; tone?: string }) {
  const percent = Math.min(100, (current / target) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={target}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
