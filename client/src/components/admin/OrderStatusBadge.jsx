import Badge from '../ui/Badge.jsx';
import { getStatus } from '../../constants/orders.js';

/**
 * Order status pill. Reads its label and tone from the shared lifecycle in
 * constants/orders.js, so the admin, the customer dashboard and public tracking
 * cannot render the same status three different ways.
 */
export default function OrderStatusBadge({ status, size = 'sm', className }) {
  const meta = getStatus(status);
  return (
    <Badge tone={meta.tone} size={size} className={className}>
      {meta.short}
    </Badge>
  );
}
