import { ArrowRightLeft, MapPin, Sparkles } from 'lucide-react';
import { formatCount, truncateText } from '../utils/formatters';

const MatchCard = ({ match, onAccept, onDecline }) => {
  const displayName = match?.user?.displayName || match?.user?.name || match?.displayName || match?.name || 'Potential match';
  const location = match?.location || match?.user?.location || 'Remote friendly';
  const score = match?.score ?? match?.compatibilityScore ?? match?.matchScore ?? null;
  const offers = match?.offeredSkills || match?.skillsOffered || match?.skills?.offered || [];
  const wants = match?.wantedSkills || match?.skillsWanted || match?.skills?.wanted || [];

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:bg-white/[0.075]">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-emerald-400/10 opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{displayName}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
            <MapPin className="h-4 w-4 text-cyan-300" />
            <span>{location}</span>
          </div>
        </div>
        {score !== null && score !== undefined && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Match</p>
            <p className="text-xl font-semibold text-cyan-100">{formatCount(score)}</p>
          </div>
        )}
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Offers</p>
          <p className="mt-2 text-sm text-white/85">
            {truncateText((offers || []).map((item) => item.name || item.title || item).join(', ') || 'Flexible sessions and practical exchange.', 80)}
          </p>
        </div>
        <div className="flex items-center justify-center text-cyan-300">
          <ArrowRightLeft className="h-5 w-5" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Wants</p>
          <p className="mt-2 text-sm text-white/85">
            {truncateText((wants || []).map((item) => item.name || item.title || item).join(', ') || 'A reciprocal exchange that fits your schedule.', 80)}
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs text-white/55">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          AI-curated fit
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDecline?.(match)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-rose-500/15 hover:text-rose-100"
          >
            Pass
          </button>
          <button
            type="button"
            onClick={() => onAccept?.(match)}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-95"
          >
            Accept
          </button>
        </div>
      </div>
    </article>
  );
};

export default MatchCard;
