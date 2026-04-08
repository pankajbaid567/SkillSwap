import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Filter, Search } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import { useMatches } from '../hooks/useMatches';

const strategyOptions = [
  { value: 'skill', label: 'Skill-based' },
  { value: 'location', label: 'Location-based' },
  { value: 'hybrid', label: 'Hybrid' },
];

const Matches = () => {
  const [strategy, setStrategy] = useState('skill');
  const [query, setQuery] = useState('');
  const { matches, stats, isLoading, acceptMatch, declineMatch } = useMatches({ strategy });

  const filteredMatches = useMemo(() => {
    if (!query.trim()) return matches;
    const needle = query.toLowerCase();
    return matches.filter((match) => JSON.stringify(match).toLowerCase().includes(needle));
  }, [matches, query]);

  const handleAccept = async (match) => {
    try {
      await acceptMatch(match.id);
      toast.success('Match accepted');
    } catch (error) {
      toast.error(error?.message || 'Unable to accept this match');
    }
  };

  const handleDecline = async (match) => {
    try {
      await declineMatch({ matchId: match.id });
      toast.success('Match declined');
    } catch (error) {
      toast.error(error?.message || 'Unable to decline this match');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Matches</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Review suggested partners</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">Search and sort through the current suggestions. Accept the best-fit exchange or pass on a profile for now.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search matches..."
                className="min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <Filter className="h-4 w-4 text-cyan-300" />
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value)}
                className="bg-transparent text-sm text-white outline-none"
              >
                {strategyOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-950">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Total matches</p>
          <p className="mt-3 text-3xl font-semibold text-white">{stats.totalMatches ?? matches.length}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Accepted</p>
          <p className="mt-3 text-3xl font-semibold text-white">{stats.acceptedMatches ?? 0}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Declined</p>
          <p className="mt-3 text-3xl font-semibold text-white">{stats.declinedMatches ?? 0}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Strategy</p>
          <p className="mt-3 text-3xl font-semibold text-white capitalize">{strategy}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-white/50">Loading matches...</div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/50">
            No matches found for the current filters.
          </div>
        ) : filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </section>
    </div>
  );
};

export default Matches;
