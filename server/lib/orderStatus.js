/**
 * Order lifecycle.
 *
 * Status changes are a state machine, not a free-text field. Without this an
 * admin can mark a delivered order "processing" again, or ship a cancelled one,
 * and the customer dashboard and the public tracking page then disagree with
 * the warehouse. Every transition is validated here so both the admin API and
 * any future automation go through the same gate.
 *
 * States come from the `orders.status` ENUM, so an invalid value cannot reach
 * the database even if this table were bypassed.
 */

/**
 * Allowed transitions. Terminal states (`delivered`, `cancelled`) have no
 * outgoing edges except the admin corrections below, which are deliberate.
 */
const TRANSITIONS = {
  placed: ['payment_confirmed', 'processing', 'cancelled'],
  payment_confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'delivered'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Statuses that mean the order is still moving. */
const OPEN_STATUSES = ['placed', 'payment_confirmed', 'processing', 'shipped', 'in_transit'];

/** Statuses that mean the order is finished. */
const CLOSED_STATUSES = ['delivered', 'cancelled'];

/** Payment states that can accompany a cancellation. */
const REFUNDABLE_PAYMENT = ['paid', 'captured', 'authorised'];

class TransitionError extends Error {
  constructor(from, to, message) {
    super(message);
    this.name = 'TransitionError';
    this.status = 409;
    this.from = from;
    this.to = to;
  }
}

function canTransition(from, to) {
  if (from === to) return false;
  return (TRANSITIONS[from] || []).includes(to);
}

/**
 * Validate a status change.
 * Throws a 409 with the legal alternatives so the admin UI can show them.
 */
function assertTransition(from, to) {
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, from)) {
    throw new TransitionError(from, to, `Unknown current status "${from}"`);
  }
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, to)) {
    throw new TransitionError(from, to, `Unknown target status "${to}"`);
  }
  if (from === to) {
    throw new TransitionError(from, to, `Order is already ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new TransitionError(
      from,
      to,
      `Cannot move an order from ${from} to ${to}. Allowed: ${
        TRANSITIONS[from].length ? TRANSITIONS[from].join(', ') : 'none (final state)'
      }`
    );
  }
  return true;
}

/** Every status a given order may move to right now. */
function allowedNext(from) {
  return TRANSITIONS[from] || [];
}

const isOpen = (status) => OPEN_STATUSES.includes(status);
const isClosed = (status) => CLOSED_STATUSES.includes(status);

/**
 * Statuses that imply a tracking number must exist. Setting `shipped` without
 * one produces a "shipped" order the customer cannot follow.
 */
const REQUIRES_TRACKING = new Set(['shipped', 'in_transit', 'delivered']);

module.exports = {
  TRANSITIONS,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  REFUNDABLE_PAYMENT,
  REQUIRES_TRACKING,
  TransitionError,
  canTransition,
  assertTransition,
  allowedNext,
  isOpen,
  isClosed,
};
