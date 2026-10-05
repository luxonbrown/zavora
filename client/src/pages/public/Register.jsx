import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PasswordField from '../../components/ui/PasswordField.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import { RedirectIfAuthenticated } from '../../components/layout/RouteGuards.jsx';

import { useAuth } from '../../context/AuthContext.jsx';
import { passwordStrength, validateEmail } from '../../services/auth.js';
import { cx } from '../../utils/format.js';

function RegisterForm() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const strength = passwordStrength(values.password);

  const set = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {};
    if (!values.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
    if (!values.lastName.trim()) nextErrors.lastName = 'Enter your last name.';
    const emailError = validateEmail(values.email);
    if (emailError) nextErrors.email = emailError;
    if (values.password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    if (!accepted) nextErrors.accepted = 'Please accept the terms to continue.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await register(values);
      navigate('/account', { replace: true });
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account for orders, tracking and saved items."
      aside={
        <div className="max-w-md">
          <p className="t-eyebrow text-paper/45">Why join</p>
          <ul className="mt-6 space-y-4">
            {[
              'Live carrier tracking on every order',
              'One-tap reorder from your history',
              'Addresses and payment methods saved securely',
              'Early access to limited drops',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-paper"
                  strokeWidth={2.2}
                  aria-hidden
                />
                <span className="t-body text-paper/85">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      }
      footer={
        <p className="t-small text-muted">
          Already have an account?{' '}
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
        {formError ? (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/6 px-4 py-3">
            <p className="t-small text-danger">{formError}</p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            size="lg"
            autoComplete="given-name"
            placeholder="Alex"
            value={values.firstName}
            error={errors.firstName}
            onChange={set('firstName')}
          />
          <Input
            label="Last name"
            name="lastName"
            size="lg"
            autoComplete="family-name"
            placeholder="Moreau"
            value={values.lastName}
            error={errors.lastName}
            onChange={set('lastName')}
          />
        </div>

        <Input
          label="Email"
          name="email"
          type="email"
          size="lg"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          error={errors.email}
          onChange={set('email')}
        />

        <div>
          <PasswordField
            label="Password"
            id="password"
            name="password"
            size="lg"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={values.password}
            error={errors.password}
            onChange={set('password')}
          />

          {/* Strength meter — only shown once typing starts */}
          {values.password ? (
            <div className="mt-3">
              <div className="flex items-center gap-3">
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

              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {strength.checks.map((check) => (
                  <li
                    key={check.id}
                    className={cx(
                      't-caption flex items-center gap-1.5',
                      check.met ? 'text-ink' : 'text-muted'
                    )}
                  >
                    <span
                      className={cx(
                        'grid size-3.5 place-items-center rounded-full',
                        check.met ? 'bg-ink text-paper' : 'border border-line-strong'
                      )}
                    >
                      {check.met ? (
                        <Check className="size-2.5" strokeWidth={3} aria-hidden />
                      ) : null}
                    </span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <Checkbox
            id="terms"
            name="terms"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              setErrors((prev) => ({ ...prev, accepted: undefined }));
            }}
            label={
              <>
                I agree to the{' '}
                <Link to="/about#terms" className="underline underline-offset-4">
                  terms of service
                </Link>{' '}
                and{' '}
                <Link to="/about#privacy" className="underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </>
            }
          />
          {errors.accepted ? (
            <p className="t-caption mt-1.5 text-danger">{errors.accepted}</p>
          ) : null}
        </div>

        <Button type="submit" variant="primary-dark" size="xl" fullWidth loading={loading}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function Register() {
  return (
    <RedirectIfAuthenticated>
      <RegisterForm />
    </RedirectIfAuthenticated>
  );
}