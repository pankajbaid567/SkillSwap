import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Globe2, Sparkles, Users, Workflow } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import { useSwap } from '../hooks/useSwap';
import { useNotifications } from '../hooks/useNotifications';
import MatchCard from '../components/MatchCard';
import SwapCard from '../components/SwapCard';
import { ROUTES } from '../constants/routes';
import { formatCount } from '../utils/formatters';

const renderStatIcon = (iconName) => {
  switch (iconName) {
    case 'workflow':
      return <Workflow className="h-5 w-5 text-cyan-300" />;
    case 'users':
      return <Users className="h-5 w-5 text-cyan-300" />;
    case 'bell':
      return <Bell className="h-5 w-5 text-cyan-300" />;
    case 'sparkles':
    default:
      return <Sparkles className="h-5 w-5 text-cyan-300" />;
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const { matches, stats: matchStats, isLoading: matchesLoading } = useMatches({ limit: 4 });
  const { activeSwaps, isLoading: swapsLoading } = useSwap();
  const { unreadCount, notifications } = useNotifications({ limit: 5 });

  const stats = useMemo(() => ([
    { label: 'Active swaps', value: activeSwaps.length, note: 'In progress or accepted', icon: 'workflow' },
    { label: 'Open matches', value: matchStats.totalMatches ?? matches.length, note: 'Potential learning partners', icon: 'users' },
    { label: 'Unread alerts', value: unreadCount, note: 'Needs your attention', icon: 'bell' },
    { label: 'Top strategy', value: matchStats.acceptedMatches ?? 0, note: 'Acceptance count this cycle', icon: 'sparkles' },
  ]), [activeSwaps.length, matchStats.acceptedMatches, matchStats.totalMatches, matches.length, unreadCount]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 text-sm text-cyan-200/80">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 font-medium">
              <Sparkles className="h-4 w-4" />
              AI matching is live
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-white/65">
              <Globe2 className="h-4 w-4 text-emerald-300" />
              Real-time coordination
            </span>
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Good to see you, {user?.displayName || user?.name || 'there'}.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Today’s workspace keeps match discovery, swaps, chat, and notifications in one focused flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={ROUTES.matches} className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
              Review matches <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={ROUTES.profile} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              Update profile
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Recent notifications</p>
          <div className="mt-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/50">
                No recent notifications.
              </div>
            ) : notifications.slice(0, 4).map((notification) => (
              <div key={notification.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{notification.title || notification.type || 'Alert'}</p>
                <p className="mt-2 text-sm text-white/55">{notification.message || notification.body || 'New activity on your account.'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon }) => (
          <article key={label} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/55">{label}</p>
              {renderStatIcon(icon)}
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{formatCount(value)}</p>
            <p className="mt-1 text-sm text-white/45">{note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Suggested matches</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">High-fit learning partners</h2>
            </div>
            <Link to={ROUTES.matches} className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">See all</Link>
          </div>

          <div className="mt-5 space-y-4">
            {matchesLoading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">Loading matches...</div>
            ) : matches.slice(0, 2).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">No matches yet. Try the matches page to fetch suggestions.</div>
            ) : matches.slice(0, 2).map((match) => <MatchCard key={match.id} match={match} />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Active swaps</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">What’s in motion now</h2>
            </div>
            <Link to={ROUTES.matches} className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">Open queue</Link>
          </div>

          <div className="mt-5 space-y-4">
            {swapsLoading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">Loading swaps...</div>
            ) : activeSwaps.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">No active swaps yet.</div>
            ) : activeSwaps.slice(0, 3).map((swap) => <SwapCard key={swap.id} swap={swap} />)}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
