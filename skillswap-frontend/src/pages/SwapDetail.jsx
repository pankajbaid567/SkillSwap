import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgeCheck, CalendarClock, TimerReset, Video, MessageSquare, Star, X } from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import SwapCard from '../components/SwapCard';
import { useSwap } from '../hooks/useSwap';
import { useChat } from '../hooks/useChat';
import { formatDateTime } from '../utils/formatters';
import { reviewAPI } from '../services/api.service';

const swapSteps = ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED'];

const SwapDetail = () => {
  const { swapId } = useParams();
  const navigate = useNavigate();
  const { swap, isLoading, acceptSwap, cancelSwap, confirmComplete, scheduleSession } = useSwap(swapId);
  const { messages, sendMessage, sendTyping, isTyping } = useChat(swapId);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) return toast.error('Please select a rating from 1 to 5 stars.');
    if (reviewComment.length < 20 || reviewComment.length > 500) return toast.error(`Comment must be between 20 and 500 characters. Currently: ${reviewComment.length}`);

    setIsSubmittingReview(true);
    try {
      await reviewAPI.submitReview(swapId, { rating: reviewRating, comment: reviewComment });
      toast.success('Review submitted successfully!');
      setIsReviewModalOpen(false);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Derive current step index
  const currentStepIdx = useMemo(() => {
    if (!swap?.status) return 0;
    if (swap.status === 'CANCELLED') return -1;
    return swapSteps.indexOf(swap.status.toUpperCase());
  }, [swap?.status]);

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
        {/* Header and Swap Overview */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
           <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
             <h1 className="text-2xl font-bold text-white">Swap Details</h1>
             <span className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full ${swap.status === 'COMPLETED' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : swap.status === 'CANCELLED' ? 'bg-rose-400/20 text-rose-300 border border-rose-400/30' : 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'}`}>
                {swap.status || 'PENDING'}
             </span>
           </div>
           
           <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-950/40 p-4 border border-white/5 flex items-center gap-3">
                 <div className="h-10 w-10 bg-cyan-400/20 rounded-full flex items-center justify-center text-cyan-400">
                   {swap.initiator?.avatarUrl ? <img src={swap.initiator.avatarUrl} alt="" className="rounded-full h-full w-full object-cover"/> : swap.initiator?.displayName?.charAt(0) || 'I'}
                 </div>
                 <div>
                   <p className="text-xs uppercase text-white/40 tracking-wider">Initiator</p>
                   <p className="text-sm font-semibold text-white">{swap.initiator?.displayName || swap.initiator?.name}</p>
                 </div>
              </div>
              <div className="rounded-2xl bg-slate-950/40 p-4 border border-white/5 flex items-center gap-3">
                 <div className="h-10 w-10 bg-emerald-400/20 rounded-full flex items-center justify-center text-emerald-400">
                   {swap.receiver?.avatarUrl ? <img src={swap.receiver.avatarUrl} alt="" className="rounded-full h-full w-full object-cover"/> : swap.receiver?.displayName?.charAt(0) || 'R'}
                 </div>
                 <div>
                   <p className="text-xs uppercase text-white/40 tracking-wider">Receiver</p>
                   <p className="text-sm font-semibold text-white">{swap.receiver?.displayName || swap.receiver?.name}</p>
                 </div>
              </div>
           </div>
        </section>

        {/* Timeline Visualizer */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-6">Status Timeline</p>
          <div className="relative flex justify-between items-center max-w-lg mx-auto">
             {/* Line background */}
             <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-1 bg-white/10 -z-10 rounded" />
             {/* Line active */}
             {currentStepIdx >= 0 && (
               <div 
                 className="absolute left-[10%] top-1/2 -translate-y-1/2 h-1 bg-cyan-400 shadow-[0_0_10px_cyan] -z-10 rounded transition-all duration-700" 
                 style={{ width: `${Math.max(0, (currentStepIdx / (swapSteps.length - 1)) * 80)}%` }} 
               />
             )}
             
             {swapSteps.map((step, idx) => {
               const isCompleted = idx < currentStepIdx;
               const isCurrent = idx === currentStepIdx;
               const isCancelled = swap.status === 'CANCELLED';
               
               return (
                 <div key={step} className="flex flex-col items-center gap-2">
                   <div className={`h-8 w-8 rounded-full flex items-center justify-center transition ${isCompleted ? 'bg-cyan-400 text-slate-950' : isCurrent ? 'bg-slate-950 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : isCancelled ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>
                     {isCompleted ? <BadgeCheck className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                   </div>
                   <span className={`text-[10px] font-bold tracking-widest uppercase ${isCurrent ? 'text-cyan-300' : 'text-white/40'}`}>{step}</span>
                 </div>
               );
             })}
          </div>
        </section>

        {/* Upcoming Session & Next Actions */}
        <div className="grid sm:grid-cols-2 gap-6">
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col">
             <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-4">First Session</p>
             <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-white/5 bg-slate-950/30 rounded-2xl">
               {swap.sessions && swap.sessions.length > 0 ? (
                 <>
                   <CalendarClock className="h-8 w-8 text-cyan-300 mb-3" />
                   <p className="text-white font-medium">{formatDateTime(swap.sessions[0].scheduledAt)}</p>
                   {swap.sessions[0].meetingLink && (
                     <a href={swap.sessions[0].meetingLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 transition rounded-full text-xs font-bold text-white">
                        <Video className="h-3 w-3" /> Join Call
                     </a>
                   )}
                 </>
               ) : (
                 <>
                   <TimerReset className="h-8 w-8 text-white/20 mb-3" />
                   <p className="text-white/40 text-sm">No session scheduled yet.</p>
                 </>
               )}
             </div>
           </section>
           
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col">
             <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-4">Actions</p>
             <div className="flex flex-col gap-3 justify-center flex-1">
                {swap.status === 'PENDING' && (
                  <>
                    <button onClick={handleAccept} className="w-full rounded-full bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95">Accept Swap</button>
                    <button onClick={handleCancel} className="w-full rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10">Decline/Cancel</button>
                  </>
                )}
                {(swap.status === 'ACCEPTED' || swap.status === 'ACTIVE') && (
                  <>
                    {(!swap.sessions || swap.sessions.length === 0) && (
                      <button onClick={handleSchedule} className="w-full rounded-full border border-indigo-400/30 bg-indigo-500/10 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/20">Schedule Session</button>
                    )}
                    <button onClick={handleConfirm} className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20">Mark Completed</button>
                  </>
                )}
                {swap.status === 'COMPLETED' && (
                  <button onClick={() => setIsReviewModalOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20">
                    <MessageSquare className="h-4 w-4" /> Leave Review
                  </button>
                )}
                {swap.status === 'CANCELLED' && (
                  <p className="text-center text-sm text-white/40 italic">This swap is inactive.</p>
                )}
             </div>
           </section>
        </div>
      </div>

      <ChatWindow
        title="Active Chat"
        subtitle="Keep the coordination in one place"
        messages={messages}
        onSend={(content) => sendMessage(content)}
        onTyping={sendTyping}
        isTyping={isTyping}
        active={swap.status !== 'CANCELLED'}
      />

      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setIsReviewModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition">
               <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-2">Leave a Review</h2>
            <p className="text-sm text-white/50 mb-6">How was your skill swap experience?</p>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                 <button key={star} onClick={() => setReviewRating(star)} className="p-1 transition-transform hover:scale-110">
                   <Star className={`h-10 w-10 ${star <= reviewRating ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'text-slate-700 hover:text-slate-500'}`} />
                 </button>
              ))}
            </div>

            <div className="mb-6 relative">
               <textarea 
                 value={reviewComment}
                 onChange={e => setReviewComment(e.target.value)}
                 placeholder="Write your review here (min 20 characters)..."
                 className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none h-32 outline-none focus:border-cyan-500/50"
               />
               <span className={`absolute bottom-3 right-3 text-xs ${reviewComment.length < 20 || reviewComment.length > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {reviewComment.length}/500
               </span>
            </div>

            <button 
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl py-3 text-slate-900 font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapDetail;
