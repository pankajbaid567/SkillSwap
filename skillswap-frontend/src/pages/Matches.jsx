import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, X, BarChart3, AlertCircle } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import { useMatches } from '../hooks/useMatches';
import { matchAPI } from '../services/api.service';

const strategyOptions = [
  { value: 'skill', label: 'Skill-Based' },
  { value: 'location', label: 'Location-Based' },
  { value: 'hybrid', label: 'AI Hybrid' },
];

const ExplainModal = ({ matchId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useMemo(() => {
    if (!matchId) return;
    setLoading(true);
    matchAPI.explainMatch(matchId).then((res) => {
      setData(res?.explanation || res);
      setLoading(false);
    }).catch(err => {
      setError(err?.message || 'Failed to load explanation');
      setLoading(false);
    });
  }, [matchId]);

  if (!matchId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
          <BarChart3 className="h-5 w-5 text-cyan-300" />
          <h3 className="text-xl font-semibold text-white">Match Explanation</h3>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-white/50">Computing compatibility factors...</div>
        ) : error ? (
          <div className="py-10 flex flex-col items-center gap-2 text-rose-300 text-sm">
            <AlertCircle className="h-6 w-6" />
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <p className="text-sm text-white/60">Here is the breakdown of why this profile is a suggested match.</p>
            
            <div className="space-y-3">
               {/* Extract features from data or fallback to some values if API varies */}
               {(() => {
                 // Example mapping based on common matching logic:
                 const breakdown = data.breakdown || [
                   { label: 'Skill Overlap', value: data.skillScore || 60, color: 'bg-emerald-400' },
                   { label: 'Reverse Match', value: data.reverseScore || 20, color: 'bg-cyan-400' },
                   { label: 'Availability', value: data.availabilityScore || 10, color: 'bg-indigo-400' },
                   { label: 'Rating', value: data.ratingScore || 10, color: 'bg-amber-400' },
                 ];
                 
                 // Normalize total to 100 for the stacked bar
                 const total = breakdown.reduce((acc, curr) => acc + curr.value, 0) || 1;

                 return (
                   <>
                     {/* Horizontal Stacked Bar */}
                     <div className="w-full h-4 rounded-full overflow-hidden flex bg-white/5 shadow-inner">
                       {breakdown.map((item, idx) => (
                         <div 
                           key={idx} 
                           className={`h-full ${item.color} transition-all duration-1000`} 
                           style={{ width: `${(item.value / total) * 100}%` }} 
                           title={`${item.label}: ${item.value}%`}
                         />
                       ))}
                     </div>
                     
                     {/* Legend */}
                     <div className="grid grid-cols-2 gap-3 mt-4">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex items-center gap-2 text-sm text-white/70">
                           <span className={`h-3 w-3 rounded-full ${item.color}`} />
                           <span>{item.label} ({Math.round((item.value / total) * 100)}%)</span>
                         </div>
                       ))}
                     </div>
                   </>
                 );
               })()}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 text-right">
               <button onClick={onClose} className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 transition">
                 Close
               </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Matches = () => {
  const [strategy, setStrategy] = useState('skill');
  const [query, setQuery] = useState('');
  const [explainingMatchId, setExplainingMatchId] = useState(null);
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
    <div className="space-y-6 relative">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Matches</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Review suggested partners</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">Search and sort through the current suggestions. Accept the best-fit exchange or pass on a profile for now.</p>
          </div>

          <div className="grid gap-3 flex-1 lg:max-w-md w-full">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search matches..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
          </div>
        </div>

        {/* Strategy Tabs */}
        <div className="mt-6 border-b border-white/10 flex gap-6 overflow-x-auto">
          {strategyOptions.map((option) => {
            const isActive = strategy === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setStrategy(option.value)}
                className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                    ? 'border-cyan-400 text-cyan-300' 
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {option.label}
              </button>
            );
          })}
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
          <p className="mt-3 text-3xl font-semibold text-cyan-300 capitalize">{strategy}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
            Finding best suited matches for you...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="col-span-full rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
            No matches found for the current strategy or filters.
          </div>
        ) : filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onExplain={() => setExplainingMatchId(match.id)}
          />
        ))}
      </section>

      {/* Explain Modal */}
      <ExplainModal matchId={explainingMatchId} onClose={() => setExplainingMatchId(null)} />
    </div>
  );
};

export default Matches;
