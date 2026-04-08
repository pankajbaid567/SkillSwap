import { SendHorizonal, MessageCircleMore } from 'lucide-react';
import { formatRelativeTime, truncateText } from '../utils/formatters';

const ChatWindow = ({ messages = [], title = 'Chat', subtitle = 'Conversation linked to this swap', onSend }) => {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-black/10">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-white/50">{subtitle}</p>
          </div>
          <MessageCircleMore className="h-5 w-5 text-cyan-300" />
        </div>
      </header>

      <div className="max-h-[28rem] space-y-3 overflow-auto p-5">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-8 text-center text-sm text-white/45">
            No messages yet. Once the swap is active, the conversation appears here.
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{message.sender?.displayName || message.sender?.name || 'Member'}</p>
                <p className="text-xs text-white/40">{formatRelativeTime(message.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm text-white/70">
                {truncateText(message.content || message.text || '', 220)}
              </p>
            </div>
          ))
        )}
      </div>

      <footer className="border-t border-white/10 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const content = String(formData.get('message') || '').trim();

            if (!content) return;
            onSend?.(content);
            event.currentTarget.reset();
          }}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
        >
          <input
            name="message"
            type="text"
            placeholder="Write a reply..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-95"
          >
            <SendHorizonal className="h-4 w-4" />
            Send
          </button>
        </form>
      </footer>
    </section>
  );
};

export default ChatWindow;
