/**
 * Chat assistant adapter.
 *
 * The backend has NO chat/AI endpoint — verified against `server/routes/`
 * (auth, products, categories, cart, checkout, orders, wishlist, addresses,
 * admin). Per the brief this is therefore a *frontend-only* assistant that
 * answers from real data the existing APIs already expose.
 *
 * To make it genuinely useful rather than a toy it resolves four intents:
 *   - product search   -> GET /products/search   (real catalogue)
 *   - order tracking   -> POST /orders/lookup    (public, redacted tracking)
 *   - shipping info    -> GET /checkout/shipping-methods
 *   - policy/help      -> real pages, linked rather than invented
 *
 * FUTURE AI HOOKUP
 * ----------------
 * `send()` is the single seam. To move to a real assistant, add an endpoint on
 * the server and change only the `REMOTE` branch below:
 *
 *     const res = await api.post('/assistant/message', { message, history });
 *     return { reply: res.data.reply, products: res.data.products ?? [] };
 *
 * Everything else (panel, bubbles, typing indicator, quick replies, product
 * cards) already consumes that `{ reply, products }` shape and needs no
 * change. Nothing here ever holds a credential — the browser has no API keys.
 */
import api from './api.js';

const SUGGESTIONS = ['Track my order', 'Find a product', 'Shipping info', 'Returns'];

const SHIPPING_COPY = {
  standard: 'Standard delivery — the best balance of speed and cost.',
  express: 'Express delivery — faster dispatch for an extra fee.',
  priority: 'Priority delivery — the fastest option we offer.',
};

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

/** True when the guest is asking to look something up. */
function intentOf(message) {
  const t = normalize(message);
  if (/\b(track|where is|order status|my order|shipment|parcel)\b/.test(t)) return 'track';
  if (/\b(track|order)/.test(t) && /\b[A-Z0-9-]{6,}\b/.test(String(message))) return 'track';
  if (/\b(ship|shipping|delivery|deliver|how long|eta|when will)\b/.test(t)) return 'shipping';
  if (/\b(return|refund|policy|exchange)\b/.test(t)) return 'policy';
  if (/\b(hi|hello|hey|thanks|thank you)\b/.test(t)) return 'greet';
  return 'search';
}

export const chatService = {
  suggestions: SUGGESTIONS,

  /**
   * Resolves a message to `{ reply, products, order, links }`.
   * Never throws for an unknown question — it degrades to a helpful pointer.
   */
  async send(message, { signal } = {}) {
    const text = String(message || '').trim();
    if (!text) return { reply: 'Ask me anything about products or your order.', products: [] };

    const intent = intentOf(text);

    try {
      switch (intent) {
        case 'greet':
          return {
            reply:
              'Hello. I can find products, track an order, or explain shipping and returns. What would you like?',
            products: [],
          };

        case 'shipping': {
          // Real endpoint. Its public shape has no prices, so we do not invent any.
          const { data } = await api.get('/checkout/shipping-methods', { signal });
          const methods = Array.isArray(data?.methods) ? data.methods : [];
          if (!methods.length) {
            return {
              reply: 'Shipping options load on the cart page once you add an item.',
              products: [],
              links: [{ label: 'Go to shipping', to: '/track-order' }],
            };
          }
          const lines = methods
            .map((m) => `• ${m.label ?? SHIPPING_COPY[m.id] ?? m.id}${m.estimatedDays ? ` — about ${m.estimatedDays}` : ''}`)
            .join('\n');
          return {
            reply: `Here are the delivery options:\n${lines}\n\nFinal cost is calculated at checkout from your address and basket.`,
            products: [],
            links: [{ label: 'View shipping information', to: '/about' }],
          };
        }

        case 'policy':
          return {
            reply:
              'Our returns and refund terms are written up in full on the About page — including how to start a return and how many days you have.',
            products: [],
            links: [{ label: 'Read the policy', to: '/about' }],
          };

        case 'track': {
          // Order numbers are MH-XXXXXX. Pull one out of the message if present.
          const match = String(message).match(/\b(MH-[A-Z0-9]+)\b/i);
          if (!match) {
            return {
              reply: 'Sure — what is your order number? It looks like MH-123456 and is at the top of your confirmation email.',
              products: [],
              links: [{ label: 'Track an order', to: '/track-order' }],
            };
          }
          const { data } = await api.post(
            '/orders/lookup',
            { orderNumber: match[1].toUpperCase() },
            { signal },
          );
          const order = data?.order;
          if (!order) {
            return {
              reply: `I could not find ${match[1].toUpperCase()}. Check the number and try again — it is in your confirmation email.`,
              products: [],
              links: [{ label: 'Track an order', to: '/track-order' }],
            };
          }
          return {
            reply: buildTrackingReply(order),
            order,
            products: [],
            links: [{ label: 'Open tracking', to: '/track-order' }],
          };
        }

        case 'search':
        default: {
          // Strip filler so "show me some running shoes" searches for the noun.
          const q = text
            .replace(/^(show|find|search|looking for|i want|can i get|do you have|some|any)\b/g, '')
            .replace(/\bplease\b/g, '')
            .trim();

          if (q.length < 2) {
            return {
              reply: 'Tell me what you are looking for — a category, a colour, or what you want to use it for.',
              products: [],
            };
          }

          const { data } = await api.get('/products/search', {
            params: { q, limit: 6 },
            signal,
          });
          const items = Array.isArray(data?.items) ? data.items : [];

          if (!items.length) {
            return {
              reply: `Nothing matched “${q}” just now. Try a broader word, or browse the full catalogue.`,
              products: [],
              links: [{ label: 'Browse all products', to: '/shop' }],
            };
          }

          return {
            reply: `Here are ${items.length} match${items.length === 1 ? '' : 'es'} for “${q}”:`,
            products: items,
          };
        }
      }
    } catch (error) {
      // A failed lookup must not look like a broken assistant.
      return {
        reply:
          error?.status === 401
            ? 'Sign in and I can look up your order.'
            : 'I could not reach the store just then. Please try again in a moment.',
        products: [],
        links: [{ label: 'Browse the catalogue', to: '/shop' }],
      };
    }
  },
};

function buildTrackingReply(order) {
  const bits = [`${order.orderNumber} is currently **${humanise(order.status)}**.`];
  if (order.trackingNumber) {
    bits.push(`Tracking number ${order.trackingNumber}${order.carrier ? ` (${order.carrier})` : ''}.`);
  }
  if (order.destination?.city) bits.push(`Arriving in ${order.destination.city}.`);
  if (order.estimatedDeliveryAt) {
    bits.push(`Estimated delivery ${new Date(order.estimatedDeliveryAt).toLocaleDateString()}.`);
  }
  return bits.join(' ');
}

function humanise(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default chatService;