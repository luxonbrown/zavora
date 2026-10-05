import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { RedirectIfAuthenticated } from '../../components/layout/RouteGuards.jsx';

import authService, { validateEmail } from '../../services/auth.js';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Always confirm the same thing regardless of whether the address exists —
  // otherwise this page becomes an account-enumeration oracle.
  if (sent) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle="If an account exists for that address, a reset link is on its way."
        aside={
          <div className="max-w-md">
            <p className="t-eyebrow text-paper/45">Next step</p>
            <p className="h3-sub mt-4 text-paper">
              The link expires in{' '}
              <span className="text-muted-on-dark">one hour.</span>
            </p>
            <p className="t-body mt-5 text-muted-on-dark">
              Nothing arrived? Check your spam folder, or try again with a different
              address.
            </p>
          </div>
        }
        footer={
          <Link
            to="/login"
            className="t-small font-medium text-ink underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-card border border-line bg-canvas p-6 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-paper text-ink">
            <MailCheck className="size-5" strokeWidth={1.6} aria-hidden />
          </span>
          <p className="t-title">Reset link sent</p>
          <p className="t-small mt-2 text-muted">
            We sent instructions to <span className="text-ink">{email}</span>.
          </p>
          <Button
            variant="outline-dark"
            size="md"
            className="mt-6"
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
          >
            Use a different email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send a reset link."
      aside={
        <div className="max-w-md">
          <p className="t-eyebrow text-paper/45">Account security</p>
          <p className="h3-sub mt-4 text-paper">
            Passwords stay{' '}
            <span className="text-muted-on-dark">hashed on our servers.</span>
          </p>
          <p className="t-body mt-5 text-muted-on-dark">
            We never store or log your password. If you did not request a reset,
            you can safely ignore the email.
          </p>
        </div>
      }
      footer={
        <p className="t-small text-muted">
          Remembered it?{' '}
          <Link
            to="/login"
            className="font-medium text-ink underline underline-offset-4 transition-opacity duration-150 hover:opacity-70"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error ? (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/6 px-4 py-3">
            <p className="t-small text-danger">{error}</p>
          </div>
        ) : null}

        <Input
          label="Email"
          name="email"
          type="email"
          size="lg"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          hint="We'll only use this to send the reset link."
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" variant="primary-dark" size="xl" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ForgotPassword() {
  return (
    <RedirectIfAuthenticated>
      <ForgotPasswordForm />
    </RedirectIfAuthenticated>
  );
}