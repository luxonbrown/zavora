/**
 * Site-wide floating chat assistant.
 *
 * A panel, not a modal — it docks to the corner on desktop and becomes a bottom
 * sheet on mobile, so it never blocks the page it is meant to help with.
 * Nothing here holds a credential; it answers from the same public endpoints
 * the rest of the storefront uses (see `services/chat.js` for the AI hookup seam).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';

import chatService from '../../services/chat.js';
import { Mark } from '../brand/Logo.jsx';
import ProductImage from '../product/ProductImage.jsx';
import { cx } from '../../utils/format.js';
import { formatPrice } from '../../utils/format.js';

let nextId = 1;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: nextId++,
      from: 'bot',
      text: 'Hi — I am the MARKETHUB assistant. Ask me to find a product, or track an order with its number.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Abandon any in-flight lookup if the panel closes mid-request.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text) => {
    const value = String(text ?? input).trim();
    if (!value || typing) return;

    setInput('');
    setMessages((prev) => [...prev, { id: nextId++, from: 'me', text: value }]);
    setTyping(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const result = await chatService.send(value, { signal: abortRef.current.signal });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          from: 'bot',
          text: result.reply,
          products: result.products ?? [],
          order: result.order ?? null,
          links: result.links ?? [],
        },
      ]);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        { id: nextId++, from: 'bot', text: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Launcher. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className={cx(
          'group fixed bottom-5 right-5 z-[60] grid size-14 place-items-center rounded-full',
          'bg-brand-gradient text-white shadow-glow-blue transition-all duration-300',
          'hover:scale-105 active:scale-95',
          open && 'rotate-90'
        )}
      >
        <span
          className="absolute inset-0 animate-ping rounded-full bg-mh-blue/40"
          style={{ animationDuration: '2.6s' }}
          aria-hidden
        />
        <span className="relative">
          {open ? <X className="size-6" strokeWidth={2} /> : <MessageCircle className="size-6" strokeWidth={2} />}
        </span>
      </button>

      {/* Panel. */}
      <div
        className={cx(
          'fixed z-[59] overflow-hidden bg-paper shadow-lift transition-all duration-300 ease-out',
          'inset-x-0 bottom-0 max-h-[78vh] rounded-t-[26px] border-t border-line',
          'sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:max-h-[600px] sm:rounded-[26px] sm:border',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
        )}
        role="dialog"
        aria-label="MARKETHUB assistant"
        aria-hidden={!open}
      >
        {/* Header. */}
        <div className="relative overflow-hidden bg-navy px-5 py-4 text-paper">
          <div className="absolute inset-0 bg-brand-gradient opacity-25" aria-hidden />
          <div className="relative flex items-center gap-3">
            <span className="relative">
              <Mark className="size-9" title={undefined} />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-mh-emerald ring-2 ring-navy" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="t-title leading-tight">MARKETHUB Assistant</p>
              <p className="t-caption flex items-center gap-1.5 text-paper/70">
                <span className="size-1.5 rounded-full bg-mh-emerald" />
                Online
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Minimise assistant"
              className="rounded-full p-1.5 text-paper/70 transition hover:bg-white/10 hover:text-paper"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Transcript. */}
        <div
          ref={listRef}
          className="no-scrollbar max-h-[46vh] flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4 sm:max-h-[380px]"
        >
          {messages.map((message) => (
            <div key={message.id}>
              <div
                className={cx(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                  message.from === 'me'
                    ? 'ml-auto bg-brand-gradient text-white'
                    : 'border border-line bg-paper text-ink'
                )}
              >
                {message.text}
              </div>

              {/* Real products from the search endpoint. */}
              {message.products?.length ? (
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                  {message.products.map((product, i) => (
                    <Link
                      key={`${product.slug}-${i}`}
                      to={`/product/${product.slug}`}
                      onClick={() => setOpen(false)}
                      className="w-[124px] shrink-0 overflow-hidden rounded-2xl border border-line bg-paper transition hover:border-mh-blue"
                    >
                      <ProductImage product={product} ratio="1/1" hoverSwap={false} />
                      <div className="p-2">
                        <p className="line-clamp-2 text-[11.5px] font-medium leading-tight text-ink">
                          {product.name}
                        </p>
                        {product.price != null ? (
                          <p className="tnum mt-1 text-[11.5px] text-muted">
                            {formatPrice(product.price)}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Real tracking result. */}
              {message.order ? (
                <div className="mt-2 rounded-2xl border border-line bg-paper p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-small font-medium text-ink">{message.order.orderNumber}</span>
                    <span className="rounded-full bg-mh-emerald/12 px-2.5 py-1 text-[11px] font-medium text-mh-emerald">
                      {String(message.order.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                  {message.order.trackingNumber ? (
                    <p className="tnum t-caption mt-1.5 text-muted">
                      {message.order.carrier} · {message.order.trackingNumber}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {message.links?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {message.links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-medium text-mh-blue transition hover:border-mh-blue"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {typing ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-paper px-3.5 py-3 w-fit">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-mh-blue"
                  style={{
                    animation: 'mh-rise 0.9s ease-in-out infinite',
                    animationDelay: `${i * 0.14}s`,
                    opacity: 0.35,
                  }}
                />
              ))}
              <span className="sr-only">Assistant is typing</span>
            </div>
          ) : null}
        </div>

        {/* Quick replies. */}
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-line bg-paper px-4 py-2.5">
          {chatService.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition hover:border-mh-blue hover:text-mh-blue"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Composer. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-line bg-paper px-3 py-3"
        >
          <label htmlFor="mh-chat-input" className="sr-only">
            Message the assistant
          </label>
          <input
            id="mh-chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about products or your order…"
            className="min-w-0 flex-1 rounded-full bg-canvas px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-mh-blue/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {typing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" strokeWidth={2} aria-hidden />
            )}
          </button>
        </form>

        <p className="flex items-center justify-center gap-1 border-t border-line bg-paper pb-2.5 text-[10.5px] text-muted/70">
          <Sparkles className="size-3" aria-hidden />
          Answers come from the live catalogue
        </p>
      </div>
    </>
  );
}