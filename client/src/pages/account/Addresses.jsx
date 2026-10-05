import { useEffect, useState } from 'react';
import { MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Sheet from '../../components/ui/Sheet.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import addressesService from '../../services/addresses.js';
import { COUNTRIES } from '../../services/shipping.js';
import { getCountry } from '../../services/shipping.js';
import { postalCode, required, validateFields, hasErrors } from '../../utils/validation.js';
import { cx } from '../../utils/format.js';

const FIELDS = [
  { name: 'label', label: 'Label', placeholder: 'Home, Office…', validate: required('Give this address a label.') },
  { name: 'firstName', label: 'First name', placeholder: 'Alex', validate: required('Enter a first name.') },
  { name: 'lastName', label: 'Last name', placeholder: 'Moreau', validate: required('Enter a last name.') },
  { name: 'phone', label: 'Phone', placeholder: '+1 555 000 1234', validate: required('Enter a phone number.') },
  { name: 'country', label: 'Country / region', as: 'select', options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })), validate: required('Choose a country.') },
  { name: 'state', label: 'State / province', placeholder: 'California', validate: required('Enter a state or province.') },
  { name: 'city', label: 'City', placeholder: 'San Francisco', validate: required('Enter a city.') },
  { name: 'address1', label: 'Address', placeholder: '1200 Market Street', validate: required('Enter a street address.') },
  { name: 'address2', label: 'Apartment, suite', placeholder: 'Optional' },
  { name: 'postalCode', label: 'Postal code', placeholder: '94103', validate: postalCode },
];

const EMPTY = {
  label: '',
  firstName: '',
  lastName: '',
  phone: '',
  country: 'US',
  state: '',
  city: '',
  address1: '',
  address2: '',
  postalCode: '',
  isDefault: false,
};

export default function Addresses() {
  const addresses = useAsync(() => addressesService.list(), []);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    document.title = 'Addresses — MARKETHUB';
  }, []);

  const open = (address) => {
    setValues(address ? { ...EMPTY, ...address } : { ...EMPTY });
    setErrors({});
    setEditing(address?.id ?? 'new');
  };

  const save = async () => {
    const nextErrors = validateFields(FIELDS, values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      if (editing === 'new') {
        await addressesService.create(values);
        toast.success('Address saved');
      } else {
        await addressesService.update(editing, values);
        toast.success('Address updated');
      }
      setEditing(null);
      addresses.reload();
    } catch (error) {
      toast.error(error.message || 'Could not save that address');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await addressesService.remove(id);
      toast.success('Address removed');
      setConfirmDelete(null);
      addresses.reload();
    } catch (error) {
      toast.error(error.message || 'Could not remove that address');
    }
  };

  const makeDefault = async (id) => {
    await addressesService.setDefault(id);
    toast.success('Default address updated');
    addresses.reload();
  };

  const list = addresses.data ?? [];

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h3-sub">Addresses</h1>
          <p className="t-small mt-2 text-muted">
            Saved addresses speed up checkout. One is always set as your default.
          </p>
        </div>
        <Button
          variant="primary-dark"
          size="md"
          iconLeft={<Plus className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={() => open(null)}
        >
          Add address
        </Button>
      </header>

      <div className="mt-8">
        {addresses.loading && !addresses.data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-card" />
            ))}
          </div>
        ) : list.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {list.map((address) => (
              <li
                key={address.id}
                className={cx(
                  'flex flex-col rounded-card border bg-paper p-6',
                  address.isDefault ? 'border-ink' : 'border-line'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="t-title">{address.label}</p>
                  {address.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper">
                      <Star className="size-3 fill-current" strokeWidth={0} aria-hidden />
                      Default
                    </span>
                  ) : null}
                </div>

                <address className="mt-3 text-[14px] leading-relaxed not-italic text-muted">
                  {address.firstName} {address.lastName}
                  <br />
                  {address.address1}
                  {address.address2 ? (
                    <>
                      <br />
                      {address.address2}
                    </>
                  ) : null}
                  <br />
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {getCountry(address.country).name}
                  <br />
                  {address.phone}
                </address>

                <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => open(address)}
                    className="t-small font-medium text-ink underline underline-offset-4"
                  >
                    Edit
                  </button>

                  {!address.isDefault ? (
                    <button
                      type="button"
                      onClick={() => makeDefault(address.id)}
                      className="t-small text-muted underline underline-offset-4 hover:text-ink"
                    >
                      Make default
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setConfirmDelete(address.id)}
                    className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.7} aria-hidden />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No saved addresses"
            description="Add an address to check out faster next time."
            action="Add address"
            actionTo="/account"
          />
        )}
      </div>

      {/* Add / edit */}
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add an address' : 'Edit address'}
        footer={
          <Button variant="primary-dark" size="lg" fullWidth loading={saving} onClick={save}>
            Save address
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((spec) => (
            <div key={spec.name} className={spec.span === 2 ? 'sm:col-span-2' : undefined}>
              {spec.as === 'select' ? (
                <Select
                  label={spec.label}
                  name={spec.name}
                  value={values[spec.name]}
                  error={errors[spec.name]}
                  onChange={(e) => {
                    setValues((p) => ({ ...p, [spec.name]: e.target.value }));
                    setErrors((p) => ({ ...p, [spec.name]: undefined }));
                  }}
                >
                  {spec.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  label={spec.label}
                  name={spec.name}
                  placeholder={spec.placeholder}
                  value={values[spec.name]}
                  error={errors[spec.name]}
                  onChange={(e) => {
                    setValues((p) => ({ ...p, [spec.name]: e.target.value }));
                    setErrors((p) => ({ ...p, [spec.name]: undefined }));
                  }}
                />
              )}
            </div>
          ))}

          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={values.isDefault}
              onChange={(e) => setValues((p) => ({ ...p, isDefault: e.target.checked }))}
              className="size-[18px] shrink-0 accent-ink"
            />
            <span className="text-[14px]">Use as my default address</span>
          </label>
        </div>
      </Sheet>

      {/* Delete confirmation */}
      <Sheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove this address?"
        description="Orders already placed keep their address."
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline-dark"
              size="lg"
              className="flex-1"
              onClick={() => setConfirmDelete(null)}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={() => remove(confirmDelete)}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="t-small text-muted">
          This cannot be undone. You can always add it again later.
        </p>
      </Sheet>
    </div>
  );
}