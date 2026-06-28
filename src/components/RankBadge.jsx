import { getRank, getRankProgress } from '../utils/rankUtils';

const SIZES = {
  sm: { pad: 'px-2 py-0.5', icon: 9, text: 'text-[10px]' },
  md: { pad: 'px-2.5 py-1', icon: 11, text: 'text-xs' },
  lg: { pad: 'px-3 py-1.5', icon: 13, text: 'text-sm' },
};

export default function RankBadge({ count = 0, size = 'sm', showTagline = false, showProgress = false }) {
  const rank = getRank(count);
  const Icon = rank.icon;
  const s = SIZES[size] || SIZES.sm;
  const progress = showProgress ? getRankProgress(count) : null;

  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold w-fit ${s.pad} ${s.text}`}
        style={{ backgroundColor: `${rank.color}1A`, color: rank.color }}
      >
        <Icon size={s.icon} />
        {rank.name}
      </span>

      {showTagline && (
        <span className="text-[11px] text-zinc-400">{rank.tagline}</span>
      )}

      {showProgress && progress?.next && (
        <div className="mt-0.5">
          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress.percent}%`, backgroundColor: progress.next.color }}
            />
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            <span className="font-medium" style={{ color: progress.next.color }}>
              {progress.remaining}
            </span>{' '}
            more contribution{progress.remaining !== 1 ? 's' : ''} to{' '}
            <span className="font-medium text-zinc-600">{progress.next.name}</span>
          </p>
        </div>
      )}

      {showProgress && !progress?.next && (
        <p className="text-[11px] text-zinc-400 mt-0.5">You've reached the top rank 🎉</p>
      )}
    </div>
  );
}