import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '../../components/layout/PageHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatNumber, formatDate, cx } from '../../utils/format.js';

/** How often to re-check while a sync is in flight. */
const POLL_MS = 4000;

const RUN_TONE = { success: 'success', partial: 'warning', failed: 'danger', running: 'info' };

function RunIcon({ status }) {
  if (status === 'success') return <CheckCircle2 className="size-4 text-success" strokeWidth={1.8} aria-hidden />;
  if (status === 'failed') return <XCircle className="size-4 text-danger" strokeWidth={1.8} aria-hidden />;
  return <Clock className="size-4 text-info" strokeWidth={1.8} aria-hidden />;
}

export default function AdminCJSync() {
  const status = useAsync(() => adminService.cjStatus(), []);
  const [starting, setStarting] = useState(false);

  const running = status.data?.running ?? false;

  // Poll only while a sync is actually running, and stop as soon as it is not —
  // an always-on timer would hammer the API for no benefit.
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => status.reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, status]);

  const start = async () => {
    setStarting(true);
    try {
      const result = await adminService.triggerSync();
      toast.success(result.message ?? 'Sync started');
      await status.reload();
    } catch (err) {
      toast.error(err.message ?? 'The sync could not be started');
    } finally {
      setStarting(false);
    }
  };

  const s = status.data;
  const latest = s?.lastRuns?.[0];

  /**
   * A failed request used to render as "not configured" / "none", because every
   * field was read with `s?.x` and `s` is null on error. That reports a
   * connection problem as a credential problem, which points debugging in the
   * wrong direction entirely. State the failure instead.
   *
   * A 401 is called out separately: the API is demonstrably reachable, so the
   * fix is "sign in", not "start the server".
   */
  if (status.error) {
    const signedOut = status.error.status === 401;
    const forbidden = status.error.status === 403;

    return (
      <div className="space-y-6">
        <PageHeader
          title="CJdropshipping sync"
          description={
            signedOut
              ? 'You are signed out.'
              : forbidden
                ? 'This account is not an administrator.'
                : 'The integration status could not be read.'
          }
        />
        <div className="rounded-xl border border-danger/40 bg-surface p-5">
          <h2 className="text-[15px] font-medium text-danger">
            {signedOut
              ? 'Sign in to continue'
              : forbidden
                ? 'Admin access required'
                : 'Cannot reach the admin API'}
          </h2>
          <p className="mt-2 text-[13.5px] text-muted">{status.error.message}</p>

          {signedOut ? (
            <p className="mt-4 text-[13px] text-muted">
              <Link to="/login" state={{ from: '/admin/cj-sync' }} className="text-ink underline underline-offset-2">
                Go to sign in
              </Link>{' '}
              — use <span className="text-ink">admin@zavora.com</span>.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5 text-[13px] text-muted">
              <li>
                Is the API running? <code className="text-ink">cd server; npm run dev</code>
              </li>
              <li>
                Is the client pointed at it?{' '}
                <code className="text-ink">VITE_USE_MOCK=false</code> in{' '}
                <code className="text-ink">client/.env.local</code>, then restart the dev server.
              </li>
            </ul>
          )}
        </div>
      </div>
    );
  }

  /** The panel is only meaningful against a real API. */
  if (s?.mockMode) {
    return (
      <div className="space-y-6">
        <PageHeader title="CJdropshipping sync" description="No API is being consulted." />
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-medium text-ink">Mock mode is on</h2>
          <p className="mt-2 text-[13.5px] text-muted">
            The client is running against fixtures, so there are no credentials to show. Start the
            API and turn mock mode off to see live CJ status.
          </p>
          <p className="mt-4 text-[13px] text-muted">
            <code className="text-ink">$env:VITE_USE_MOCK = &apos;false&apos;; npm run dev</code>
          </p>
        </div>
      </div>
    );
  }

  if (status.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="CJdropshipping sync" description="Reading connection status…" />
        <Skeleton className="h-[110px] rounded-xl" />
        <Skeleton className="h-[220px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CJdropshipping sync"
        description="The catalogue is supplied by CJ. One request per second is CJ's hard limit, so a full import takes a few minutes."
        actions={
          <Button onClick={start} disabled={starting || running || !s?.configured}>
            <RefreshCw className={cx('size-3.5', running && 'animate-spin')} strokeWidth={1.7} aria-hidden />
            {running ? 'Sync running…' : 'Start sync'}
          </Button>
        }
      />

      {/* Connection */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="t-caption text-muted">Credentials</p>
            <p className="mt-1">
              {s?.configured ? (
                <Badge size="xs" tone="success">
                  configured
                </Badge>
              ) : (
                <Badge size="xs" tone="danger">
                  not configured
                </Badge>
              )}
            </p>
          </div>
          <div>
            <p className="t-caption text-muted">Access token</p>
            <p className="mt-1">
              {s?.authenticated ? (
                <Badge size="xs" tone="success">
                  valid
                </Badge>
              ) : (
                <Badge size="xs" tone="warning">
                  {s?.hasToken ? 'expired' : 'none'}
                </Badge>
              )}
            </p>
          </div>
          {s?.openId ? (
            <div>
              <p className="t-caption text-muted">Account</p>
              <p className="tnum mt-1 text-[14px] text-ink">{s.openId}</p>
            </div>
          ) : null}
          {s?.tokenExpiresAt ? (
            <div>
              <p className="t-caption text-muted">Token expires</p>
              <p className="mt-1 text-[14px] text-ink">{formatDate(s.tokenExpiresAt)}</p>
            </div>
          ) : null}
          {s?.rateLimit ? (
            <div>
              <p className="t-caption text-muted">Rate limit</p>
              <p className="tnum mt-1 text-[14px] text-ink">{s.rateLimit}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Latest run */}
      {latest ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-medium text-ink">Latest run</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span className="inline-flex items-center gap-2">
              <RunIcon status={latest.status} />
              <span className="text-ink">{latest.status}</span>
            </span>
            <span className="tnum text-muted">{formatNumber(latest.productsSeen)} seen</span>
            <span className="tnum text-muted">{formatNumber(latest.productsCreated)} created</span>
            <span className="tnum text-muted">{formatNumber(latest.productsUpdated)} updated</span>
            <span className="tnum text-muted">{formatNumber(latest.productsSkipped)} unchanged</span>
            {latest.productsFailed > 0 ? (
              <span className="tnum text-danger">{formatNumber(latest.productsFailed)} failed</span>
            ) : null}
            <span className="text-muted">{formatDate(latest.startedAt, { withTime: true })}</span>
          </div>
          {latest.error ? (
            <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] break-all text-danger">
              {latest.error}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* History */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-medium text-ink">Run history</h2>
        </header>

        {status.loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (s?.lastRuns?.length ?? 0) === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-muted">No syncs have run yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {s.lastRuns.map((run) => (
              <li key={run.runId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <RunIcon status={run.status} />
                <Badge size="xs" tone={RUN_TONE[run.status] ?? 'neutral'}>
                  {run.status}
                </Badge>
                <span className="tnum text-[13px] text-muted">
                  {formatNumber(run.productsSeen)} seen · {formatNumber(run.productsCreated)} new ·{' '}
                  {formatNumber(run.productsUpdated)} updated
                </span>
                {run.productsFailed > 0 ? (
                  <span className="tnum text-[13px] text-danger">{formatNumber(run.productsFailed)} failed</span>
                ) : null}
                <span className="ml-auto text-[12px] whitespace-nowrap text-muted">
                  {formatDate(run.startedAt, { withTime: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
