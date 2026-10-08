import { useState } from 'react';
import { toast } from 'sonner';

import PageHeader from '../../components/layout/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';

export default function AdminSettings() {
  const result = useAsync(() => adminService.settings(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const settings = result.data?.settings ?? [];
  const editable = settings.filter((s) => s.editable);
  const locked = settings.filter((s) => !s.editable);

  const valueOf = (s) => (draft && s.key in draft ? draft[s.key] : s.value);

  const save = async () => {
    setSaving(true);
    try {
      await adminService.saveSettings(draft ?? {});
      toast.success('Settings saved');
      setDraft(null);
      result.reload();
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Store settings" description="Live values from the store_settings table." />

      {result.loading ? (
        <Skeleton className="h-[240px] rounded-xl" />
      ) : result.error ? (
        <EmptyState title="Could not load settings" description={result.error?.message} />
      ) : (
        <>
          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="text-[15px] font-medium text-ink">Editable</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {editable.map((s) => (
                <Input
                  key={s.key}
                  label={s.key}
                  value={valueOf(s)}
                  onChange={(e) => setDraft((d) => ({ ...(d ?? {}), [s.key]: e.target.value }))}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary-dark" size="md" loading={saving} onClick={save} disabled={!draft}>
                Save changes
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="text-[15px] font-medium text-ink">Read-only (integration state)</h2>
            <dl className="mt-4 divide-y divide-line">
              {locked.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-6 py-2.5">
                  <dt className="text-[13px] text-muted">{s.key}</dt>
                  <dd className="tnum max-w-[50%] truncate text-[13px] text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
