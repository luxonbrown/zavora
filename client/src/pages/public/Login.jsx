import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PasswordField from '../../components/ui/PasswordField.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import { RedirectIfAuthenticated } from '../../components/layout/RouteGuards.jsx';

import { useAuth } from '../../context/AuthContext.jsx';
import { ADMIN_CREDENTIALS, DEMO_CREDENTIALS, validateEmail } from '../../services/auth.js';
import { landingPathFor } from '../../constants/roles.js';

function LoginForm() {
  const { login, loading, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    clearSessionExpired();
    setFormError(null);

    const nextErrors = {};
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      // `login` returns the freshly-fetched user; the `user` from useAuth() is
      // still null in this closure because setState has not flushed yet.
      const signedIn = await login({ email, password, remember });
      // An explicit `from` always wins (e.g. /admin bounced us here). Otherwise
      // admins land on the dashboard and customers on their account.
      const from = location.state?.from;
      navigate(
        from && from !== '/login' ? from : landingPathFor(signedIn?.role),
        { replace: true },
      );
    } catch (error) {
      setFormError(error.message);
    }
  };

  const useDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setErrors({});
    setFormError(null);
  };

  const useAdmin = () => {
    setEmail(ADMIN_CREDENTIALS.email);
    setPassword(ADMIN_CREDENTIALS.password);
    setErrors({});
    setFormError(null);
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your orders, tracking and saved items."
      aside={
        <div className="max-w-md">
          <p className="t-eyebrow text-paper/45">Members</p>
          <p className="h3-sub mt-4 text-paper">
            Every order tracked,{' '}
            <span className="text-muted-on-dark">from our warehouse to your door.</span>
          </p>
          <p className="t-body mt-5 text-muted-on-dark">
            Sign in to see live carrier updates, reorder in one tap, and keep your
            addresses on file.
          </p>
        </div>
      }
      footer={
        <p className="t-small text-muted">
          New to MARKETHUB?{' '}
          <Link
            to="/register"
            className="font-medium text-ink underline underline-offset-4 transition-opacity duration-150 hover:opacity-70"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {sessionExpired ? (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-warning/35 bg-warning/8 px-4 py-3"
          >
            <Info className="mt-px size-4 shrink-0 text-[#96650a]" strokeWidth={1.8} aria-hidden />
            <p className="t-small text-ink">
              Your session expired. Please sign in again to continue.
            </p>
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/6 px-4 py-3"
          >
            <p className="t-small text-danger">{formError}</p>
          </div>
        ) : null}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          size="lg"
          placeholder="you@example.com"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="t-small font-medium text-ink">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="t-caption text-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            name="password"
            size="lg"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            error={errors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Checkbox
          id="remember"
          name="remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          label="Keep me signed in"
        />

        <Button
          type="submit"
          variant="primary-dark"
          size="xl"
          fullWidth
          loading={loading}
        >
          Sign in
        </Button>
      </form>

      {/* Seeded accounts. Both autofill the WHOLE pair, because filling only
          the email and leaving the demo password behind is the natural way to
          end up with "Incorrect email or password" on the admin account. */}
      <div className="mt-6 space-y-2 rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-3">
        <p className="t-caption text-muted">Seeded accounts — click to fill both fields:</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-muted">Customer</span>
          <button
            type="button"
            onClick={useDemo}
            className="font-medium text-ink underline underline-offset-4"
          >
            {DEMO_CREDENTIALS.email}
          </button>
          <span className="text-muted">· {DEMO_CREDENTIALS.password}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-muted">Admin</span>
          <button
            type="button"
            onClick={useAdmin}
            className="font-medium text-ink underline underline-offset-4"
          >
            {ADMIN_CREDENTIALS.email}
          </button>
          <span className="text-muted">· {ADMIN_CREDENTIALS.password}</span>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function Login() {
  return (
    <RedirectIfAuthenticated>
      <LoginForm />
    </RedirectIfAuthenticated>
  );
}