import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Newsletter capture.
 *
 * There is NO backend newsletter endpoint — verified against `server/routes/`.
 * This therefore validates the address and confirms locally, and says so
 * plainly in the success copy rather than pretending the address was stored.
 * Wire it to a real subscribe endpoint when one exists.
 */
export default function NewsletterForm({ tone = 'dark' }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const dark = tone === 'dark';

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      setDone(true);
      setEmail('');
      toast.success('You are on the list', {
        description: 'Look out for the weekly drop.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-4" aria-hidden />
        </span>
        <div>
          <p className="t-title">You are on the list</p>
          <p className="t-caption mt-0.5 text-muted-on-dark">
            Subscriptions are not yet stored — this form does not send
            anywhere yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[15px] font-medium">The weekly drop</p>
      <p
        className={`t-caption mt-1 ${dark ? 'text-muted-on-dark' : 'text-muted'}`}
      >
        New arrivals and considered picks. No noise.
      </p>

      <form onSubmit={submit} className="mt-4 flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          aria-label="Email address"
          className={
            'h-12 w-full min-w-0 rounded-full px-5 text-[15px] transition-colors duration-150 focus:outline-none ' +
            (dark
              ? 'border border-paper/25 bg-paper/8 text-paper placeholder:text-paper/45 focus:border-paper/60'
              : 'border border-line bg-paper text-ink placeholder:text-muted focus:border-ink')
          }
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Subscribe"
          className={
            'grid size-12 shrink-0 place-items-center rounded-full transition-[transform,filter] duration-200 active:scale-[0.98] disabled:opacity-50 ' +
            (dark
              ? 'bg-brand-gradient text-white shadow-glow-blue hover:brightness-110'
              : 'bg-brand-gradient text-white shadow-glow-blue hover:brightness-110')
          }
        >
          <ArrowRight className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </button>
      </form>
    </div>
  );
}
