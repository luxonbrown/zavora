import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '../../components/ui/Button.jsx';
import PasswordField from '../../components/ui/PasswordField.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import { passwordStrength, validateFields, hasErrors } from '../../utils/validation.js';
import { cx } from '../../utils/format.js';

const PREFERENCES = [
  {
    id: 'orderUpdates',
    label: 'Order and delivery updates',
    description: 'Dispatch, transit and delivery notifications. On by default.',
    locked: true,
  },
  {
    id: 'backInStock',
    label: 'Back in stock alerts',
    description: 'When something on your wishlist is available again.',
  },
  {
    id: 'weeklyDrop',
    label: 'The weekly drop',
    description: 'New arrivals and considered picks, once a week.',
  },
  {
    id: 'offers',
    label: 'Occasional offers',
    description: 'Rarely — only when there is something genuinely worth it.',
  },
];

export default function Settings() {
  const [preferences, setPreferences] = useState({
    orderUpdates: true,
    backInStock: true,
    weeklyDrop: false,
    offers: false,
  });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = 'Account settings — MARKETHUB';
  }, []);

  const strength = passwordStrength(passwords.next);

  const changePassword = async (event) => {
    event.preventDefault();

    const nextErrors = validateFields(
      [
        { name: 'current', validate: (v) => (v ? null : 'Enter your current password.') },
        {
          name: 'next',
          validate: (v) =>
            !v ? 'Choose a new password.' : v.length < 8 ? 'Use at least 8 characters.' : null,
        },
        {
          name: 'confirm',
          validate: (v) =>
            !v
              ? 'Confirm your new password.'
              : v !== passwords.next
                ? 'Passwords do not match.'
                : null,
        },
      ],
      passwords
    );
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      // Step 11 posts this to POST /account/password.
      await new Promise((r) => setTimeout(r, 450));
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      // Step 11 persists these to the `users` table.
      await new Promise((r) => setTimeout(r, 350));
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header>
        <h1 className="h3-sub">Account settings</h1>
        <p className="t-small mt-2 text-muted">Password and what we email you about.</p>
      </header>

      {/* Password */}
      <section className="mt-8 rounded-card border border-line p-6">
        <h2 className="t-title">Password</h2>

        <form onSubmit={changePassword} noValidate className="mt-5 space-y-5">
          <PasswordField
            label="Current password"
            name="current"
            autoComplete="current-password"
            value={passwords.current}
            error={errors.current}
            onChange={(e) => {
              setPasswords((p) => ({ ...p, current: e.target.value }));
              setErrors((p) => ({ ...p, current: undefined }));
            }}
          />

          <div>
            <PasswordField
              label="New password"
              name="next"
              autoComplete="new-password"
              value={passwords.next}
              error={errors.next}
              onChange={(e) => {
                setPasswords((p) => ({ ...p, next: e.target.value }));
                setErrors((p) => ({ ...p, next: undefined }));
              }}
            />

            {passwords.next ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cx(
                        'h-1 flex-1 rounded-full transition-colors duration-200',
                        i < strength.score ? 'bg-ink' : 'bg-surface-muted'
                      )}
                    />
                  ))}
                </div>
                <span className="t-caption w-16 text-right text-muted">{strength.label}</span>
              </div>
            ) : null}
          </div>

          <PasswordField
            label="Confirm new password"
            name="confirm"
            autoComplete="new-password"
            value={passwords.confirm}
            error={errors.confirm}
            onChange={(e) => {
              setPasswords((p) => ({ ...p, confirm: e.target.value }));
              setErrors((p) => ({ ...p, confirm: undefined }));
            }}
          />

          <div className="flex justify-end">
            <Button type="submit" variant="primary-dark" size="lg" loading={saving}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      {/* Notifications */}
      <section className="mt-4 rounded-card border border-line p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="t-title">Notifications</h2>
          {saved ? <span className="t-caption text-success">Saved</span> : null}
        </div>

        <ul className="mt-5 divide-y divide-line">
          {PREFERENCES.map((pref) => (
            <li key={pref.id} className="flex items-start justify-between gap-6 py-4 first:pt-0">
              <div className="min-w-0">
                <p className="t-small font-medium">{pref.label}</p>
                <p className="t-caption mt-1 text-muted">{pref.description}</p>
              </div>
              <Checkbox
                id={pref.id}
                name={pref.id}
                checked={preferences[pref.id]}
                disabled={pref.locked}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, [pref.id]: e.target.checked }))
                }
                label={<span className="sr-only">{pref.label}</span>}
                className="w-auto shrink-0"
              />
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Button
            variant="primary-dark"
            size="lg"
            loading={saving}
            onClick={savePreferences}
          >
            Save preferences
          </Button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-4 rounded-card border border-danger/25 p-6">
        <h2 className="t-title">Delete account</h2>
        <p className="t-small mt-2 text-muted">
          This removes your profile, saved addresses and order history. Orders already
          shipped are retained for tax records.
        </p>
        <Button variant="outline-dark" size="lg" className="mt-5">
          Request account deletion
        </Button>
      </section>
    </div>
  );
}