/**
 * Order lifecycle. Shared by the customer dashboard, the public tracking page
 * and the admin, so a status can never mean two things.
 *
 * `tone` values are Badge tones (neutral/ink/outline/success/warning/danger/
 * info). The admin additionally drives its status actions from the SERVER's
 * transition table rather than this list, because only the server knows which
 * moves are legal for a given order.
 */
export const ORDER_STATUSES = [
  { id: 'placed', label: 'Order placed', short: 'Placed', tone: 'neutral' },
  { id: 'payment_confirmed', label: 'Payment confirmed', short: 'Paid', tone: 'info' },
  { id: 'processing', label: 'Processing', short: 'Processing', tone: 'warning' },
  { id: 'shipped', label: 'Shipped', short: 'Shipped', tone: 'info' },
  { id: 'in_transit', label: 'In transit', short: 'In transit', tone: 'info' },
  { id: 'delivered', label: 'Delivered', short: 'Delivered', tone: 'success' },
  // Present in the schema and reachable from the admin; previously missing here,
  // so a cancelled order rendered as the fallback "Order placed".
  { id: 'cancelled', label: 'Cancelled', short: 'Cancelled', tone: 'danger' },
];

export const ORDER_STATUS_IDS = ORDER_STATUSES.map((s) => s.id);

export function getStatus(statusId) {
  return (
    ORDER_STATUSES.find((s) => s.id === statusId) ??
    // An unrecognised status should never blank the UI; treat it as earliest.
    ORDER_STATUSES[0]
  );
}

export function statusIndex(statusId) {
  const index = ORDER_STATUS_IDS.indexOf(statusId);
  return index === -1 ? 0 : index;
}

export function isTerminal(statusId) {
  return statusId === 'delivered' || statusId === 'cancelled';
}

/** Orders still moving toward delivery. */
export function isActive(statusId) {
  return statusId !== 'delivered' && statusId !== 'cancelled';
}

/** Human summary used on cards and in the admin table. */
export function describeStatus(statusId) {
  return getStatus(statusId).label;
}