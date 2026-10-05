import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  validateEmail,
  validatePhone,
  required,
  validateFields,
  hasErrors,
} from '../../utils/validation.js';

export default function Profile() {
  const { user } = useAuth();
  const [values, setValues] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'My profile — MARKETHUB';
  }, []);

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = validateFields(
      [
        { name: 'firstName', validate: required('Enter your first name.') },
        { name: 'lastName', validate: required('Enter your last name.') },
        { name: 'email', validate: validateEmail },
        { name: 'phone', validate: validatePhone },
      ],
      values
    );
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      // Step 11 posts this to PATCH /account/profile. Until then the profile is
      // session-local, so there is no server round-trip to await.
      await new Promise((r) => setTimeout(r, 400));
      toast.success('Profile saved', { description: 'Your details are up to date.' });
    } finally {
      setSaving(false);
    }
  };

  const set = (name) => (event) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  return (
    <div className="max-w-2xl">
      <header>
        <h1 className="h3-sub">My profile</h1>
        <p className="t-small mt-2 text-muted">
          The name and email used for receipts and delivery updates.
        </p>
      </header>

      <form onSubmit={submit} noValidate className="mt-8 rounded-card border border-line p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="First name"
            value={values.firstName}
            error={errors.firstName}
            onChange={set('firstName')}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            value={values.lastName}
            error={errors.lastName}
            onChange={set('lastName')}
            autoComplete="family-name"
          />
          <Input
            label="Email"
            type="email"
            value={values.email}
            error={errors.email}
            hint="Used for receipts and delivery updates."
            onChange={set('email')}
            autoComplete="email"
          />
          <Input
            label="Phone"
            type="tel"
            value={values.phone}
            error={errors.phone}
            onChange={set('phone')}
            placeholder="+1 555 000 1234"
            autoComplete="tel"
          />
        </div>

        <div className="mt-7 flex items-center justify-between gap-4">
          <p className="t-caption text-muted">Member since March 2026</p>
          <Button type="submit" variant="primary-dark" size="lg" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}