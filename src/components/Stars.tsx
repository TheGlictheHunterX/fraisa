export default function Stars({ rating, count }: { rating: number; count?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm">
      <span className="text-amber-500" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {"★".repeat(filled)}
        <span className="text-slate-300">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="font-semibold text-slate-700">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-slate-400">({count})</span>}
    </span>
  );
}
