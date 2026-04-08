import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, CircleCheckBig, TimerReset } from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import SwapCard from '../components/SwapCard';
import { useSwap } from '../hooks/useSwap';
import { useChat } from '../hooks/useChat';
import { formatDateTime } from '../utils/formatters';

const SwapDetail = () => {
  const { swapId } = useParams();
  const { swap, isLoading, acceptSwap, cancelSwap, confirmComplete, scheduleSession } = useSwap(swapId);
  const { messages } = useChat(swapId);

  const actionHints = useMemo(() => ([
    'Accept to move the swap into an active state.',
    'Cancel with a reason when the exchange is no longer viable.',
    'Schedule a session once the swap is confirmed.',
  ]), []);

  const handleSchedule = async () => {
    try {
      await scheduleSession({
        id: swapId,
        payload: {
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          durationMins: 60,
          notes: 'Scheduled from the frontend detail screen.',
        },
      });
      toast.success('Session scheduled');
    } catch (error) {
      toast.error(error?.message || 'Unable to schedule a session');
    }
  };

  const handleAccept = async () => {
    try {
      await acceptSwap(swapId);
      toast.success('Swap accepted');
    } catch (error) {
      toast.error(error?.message || 'Unable to accept swap');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSwap({ id: swapId, reason: 'Cancelled from frontend detail screen.' });
      toast.success('Swap cancelled');
    } catch (error) {
      toast.error(error?.message || 'Unable to cancel swap');
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmComplete(swapId);
      toast.success('Completion confirmed');
    } catch (error) {
      toast.error(error?.message || 'Unable to confirm completion');
    }
  };

  if (isLoading && !swap) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-white/50">Loading swap details...</div>;
  }

  if (!swap) {
    return <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/50">Swap not found.</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <SwapCard swap={swap} />

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Swap timeline</p>
          <div className="mt-5 space-y-4 text-sm text-white/65">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <CalendarClock className="h-4 w-4 text-cyan-300" />
              Created {formatDateTime(swap.createdAt)}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <TimerReset className="h-4 w-4 text-cyan-300" />
              Scheduled {swap.scheduledAt ? formatDateTime(swap.scheduledAt) : 'Not scheduled yet'}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <CircleCheckBig className="h-4 w-4 text-cyan-300" />
              Status {swap.status || 'PENDING'}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Next actions</p>
          <ul className="mt-4 space-y-3 text-sm text-white/60">
            {actionHints.map((hint) => (
              <li key={hint} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">{hint}</li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={handleAccept} type="button" className="rounded-full bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:opacity-95">Accept</button>
            <button onClick={handleSchedule} type="button" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10">Schedule session</button>
            <button onClick={handleConfirm} type="button" className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-400/15">Confirm complete</button>
            <button onClick={handleCancel} type="button" className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 font-semibold text-rose-100 transition hover:bg-rose-400/15">Cancel</button>
          </div>
        </section>
      </div>

      <ChatWindow
        title="Swap chat"
        subtitle="Keep the coordination in one place"
        messages={messages}
      />
    </div>
  );
};

export default SwapDetail;
