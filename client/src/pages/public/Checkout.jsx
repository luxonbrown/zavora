import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, CreditCard, Mail, MapPin, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';

import Container from '../../components/layout/Container.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import CheckoutStep from '../../components/checkout/CheckoutStep.jsx';
import OrderSummaryPanel from '../../components/checkout/OrderSummaryPanel.jsx';
import ContactStep from '../../components/checkout/ContactStep.jsx';
import AddressStep from '../../components/checkout/AddressStep.jsx';
import ShippingStep from '../../components/checkout/ShippingStep.jsx';
import PaymentStep from '../../components/checkout/PaymentStep.jsx';
import ReviewStep from '../../components/checkout/ReviewStep.jsx';

import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import checkoutService from '../../services/checkout.js';
import { getCountry } from '../../services/shipping.js';
import { cardNumber, cvc, expiry, hasErrors, validateFields } from '../../utils/validation.js';
import { validateEmail, validatePhone, postalCode, required } from '../../utils/validation.js';
import { cx } from '../../utils/format.js';

const CONTACT_FIELDS = [
  { name: 'email', validate: validateEmail },
  { name: 'phone', validate: validatePhone },
];

const ADDRESS_FIELDS = [
  { name: 'firstName', validate: required('Enter your first name.') },
  { name: 'lastName', validate: required('Enter your last name.') },
  { name: 'country', validate: required('Choose a destination.') },
  { name: 'state', validate: required('Enter your state or province.') },
  { name: 'city', validate: required('Enter your city.') },
  { name: 'address1', validate: required('Enter your street address.') },
  { name: 'postalCode', validate: postalCode },
];

const PAYMENT_FIELDS = [
  { name: 'cardNumber', validate: cardNumber },
  { name: 'expiry', validate: expiry },
  { name: 'cvc', validate: cvc },
  { name: 'cardName', validate: required('Enter the name on the card.') },
];

const STEP_COUNT = 5;

export default function Checkout() {
  const { items, clear, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);

  const [contact, setContact] = useState(() => ({
    email: user?.email ?? '',
    phone: '',
  }));
  const [address, setAddress] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    country: 'US',
    state: '',
    city: '',
    address1: '',
    address2: '',
    postalCode: '',
  }));
  const [shippingMethodId, setShippingMethodId] = useState('standard');
  const [payment, setPayment] = useState({
    method: 'card',
    cardNumber: '',
    expiry: '',
    cvc: '',
    cardName: '',
  });

  const [errors, setErrors] = useState({});
  const [shippingMethods, setShippingMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [methodsError, setMethodsError] = useState(null);

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);

  // Keep the latest lines in a ref so the quote effect can stay keyed on the
  // values that actually change its result.
  const linesRef = useRef(items);
  linesRef.current = items;

  const linesKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.variantId ?? '-'}:${i.quantity}`).join('|'),
    [items]
  );

  const paymentMethods = useMemo(() => checkoutService.paymentMethods(), []);

  // ---------- shipping methods, recalculated per destination ----------
  const loadShippingMethods = useCallback(async (countryCode) => {
    setMethodsLoading(true);
    setMethodsError(null);
    try {
      const methods = await checkoutService.shippingMethods({
        countryCode,
        subtotal,
      });
      setShippingMethods(methods);
      setShippingMethodId((current) =>
        methods.some((m) => m.id === current) ? current : methods[0]?.id
      );
    } catch (error) {
      setMethodsError(error.message || 'Unable to calculate shipping options.');
    } finally {
      setMethodsLoading(false);
    }
  }, [subtotal]);

  useEffect(() => {
    if (items.length === 0) return;
    loadShippingMethods(address.country);
  }, [address.country, items.length, loadShippingMethods]);

  // ---------- authoritative quote ----------
  const requestQuote = useCallback(async () => {
    if (linesRef.current.length === 0) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      // Prices are sent only so the server can *detect* tampering; it prices
      // from the catalogue and rejects mismatches.
      const result = await checkoutService.quote({
        lines: linesRef.current.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          price: i.price,
        })),
        countryCode: address.country,
        shippingMethodId,
      });
      setQuote(result);
    } catch (error) {
      setQuote(null);
      setQuoteError(error.message || 'We could not prepare your order. Please try again.');
    } finally {
      setQuoteLoading(false);
    }
  }, [address.country, shippingMethodId]);

  useEffect(() => {
    if (items.length === 0) return;
    requestQuote();
  }, [linesKey, address.country, shippingMethodId, items.length, requestQuote]);

  // ---------- step navigation ----------
  const goTo = (next) => {
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    setErrors({});
  };

  const validateStep = (index) => {
    if (index === 0) return validateFields(CONTACT_FIELDS, contact);
    if (index === 1) return validateFields(ADDRESS_FIELDS, address);
    if (index === 3 && payment.method === 'card') {
      return validateFields(PAYMENT_FIELDS, payment);
    }
    return {};
  };

  const advance = () => {
    const stepErrors = validateStep(step);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      return;
    }
    goTo(Math.min(step + 1, STEP_COUNT - 1));
  };

  const back = () => goTo(Math.max(step - 1, 0));

  // ---------- place order ----------
  const placeOrder = async () => {
    setPlacing(true);
    setPlaceError(null);
    try {
      // Re-price at the moment of purchase rather than trusting the quote.
      const order = await checkoutService.placeOrder({
        lines: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          price: i.price,
        })),
        contact,
        address,
        shippingMethodId,
        payment: {
          method: payment.method,
          cardNumber: payment.cardNumber,
          expiry: payment.expiry,
          cvc: payment.cvc,
          cardName: payment.cardName,
        },
      });

      clear();
      navigate('/order-confirmed', { replace: true, state: { order } });
    } catch (error) {
      setPlaceError(error.message || 'We could not place your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ---------- empty cart ----------
  if (items.length === 0 && !placing) {
    return (
      <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
        <Container>
          <header className="max-w-2xl">
            <p className="t-eyebrow">Checkout</p>
            <h1 className="h2-section mt-3">Nothing to check out</h1>
          </header>
          <div className="mt-12 max-w-xl">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Add something you like and come back — checkout takes about a minute."
              action="Browse products"
              actionTo="/shop"
            />
          </div>
        </Container>
      </div>
    );
  }

  const stepSummary = [
    contact.email,
    [address.firstName, address.lastName].filter(Boolean).join(' ') +
      (address.address1 ? `, ${address.address1}` : ''),
    shippingMethods.find((m) => m.id === shippingMethodId)?.name,
    paymentMethods.find((m) => m.id === payment.method)?.name,
  ];

  /**
   * A step only counts as complete once the customer has advanced past it.
   * `shippingMethodId` and `payment.method` both have defaults, so testing the
   * value alone marked Shipping method as done before it was ever opened.
   */
  const isComplete = (index) => {
    if (index === 4) return false;
    if (furthest <= index) return false;
    if (index === 3 && payment.method === 'card') {
      return !hasErrors(validateStep(3));
    }
    return true;
  };

  const cardLast4 = payment.cardNumber.replace(/\D/g, '').slice(-4) || null;

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container>
        <header className="max-w-2xl">
          <p className="t-eyebrow">Secure checkout</p>
          <h1 className="h2-section mt-3">Checkout</h1>
          <p className="t-body mt-4 flex items-center gap-2 text-muted">
            <ShieldCheck className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
            Prices, stock and shipping are verified on our servers before payment.
          </p>
        </header>

        {/* `grid-cols-1` is explicit on purpose: an implicit `auto` track is
            floored at its min-content width, which pushed the steps card wider
            than the viewport on narrow screens. `minmax(0, 1fr)` can shrink. */}
        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
          {/* Steps */}
          <div className="min-w-0 overflow-hidden rounded-card border border-line">
            <CheckoutStep
              index={1}
              icon={Mail}
              title="Contact"
              summary={stepSummary[0]}
              open={step === 0}
              complete={isComplete(0)}
              onToggle={() => goTo(0)}
            >
              <ContactStep
                values={contact}
                errors={errors}
                onChange={(spec) => (event) =>
                  setContact((prev) => ({ ...prev, [spec.name]: event.target.value }))
                }
                onContinue={advance}
              />
            </CheckoutStep>

            <CheckoutStep
              index={2}
              icon={MapPin}
              title="Shipping address"
              summary={stepSummary[1]}
              open={step === 1}
              complete={isComplete(1)}
              onToggle={() => (furthest >= 1 ? goTo(1) : goTo(0))}
            >
              <AddressStep
                values={address}
                errors={errors}
                onChange={(spec) => (event) =>
                  setAddress((prev) => ({ ...prev, [spec.name]: event.target.value }))
                }
                onContinue={advance}
                onBack={back}
                contactPhone={contact.phone}
                onEditPhone={() => goTo(0)}
              />
            </CheckoutStep>

            <CheckoutStep
              index={3}
              title="Shipping method"
              summary={stepSummary[2]}
              open={step === 2}
              complete={isComplete(2)}
              onToggle={() => (furthest >= 2 ? goTo(2) : goTo(1))}
            >
              <ShippingStep
                methods={shippingMethods}
                value={shippingMethodId}
                onChange={setShippingMethodId}
                onContinue={advance}
                onBack={back}
                loading={methodsLoading}
                error={methodsError}
                onRetry={() => loadShippingMethods(address.country)}
              />
            </CheckoutStep>

            <CheckoutStep
              index={4}
              title="Payment"
              summary={stepSummary[3]}
              open={step === 3}
              complete={isComplete(3)}
              onToggle={() => (furthest >= 3 ? goTo(3) : goTo(2))}
            >
              <PaymentStep
                methods={paymentMethods}
                method={payment.method}
                card={payment}
                errors={errors}
                onMethodChange={(method) => {
                  setPayment((prev) => ({ ...prev, method }));
                  setErrors({});
                }}
                onCardChange={(next) => {
                  setPayment((prev) => ({ ...prev, ...next }));
                  setErrors((prev) => ({ ...prev, cardNumber: undefined, expiry: undefined, cvc: undefined, cardName: undefined }));
                }}
                onContinue={advance}
                onBack={back}
              />
            </CheckoutStep>

            <CheckoutStep
              index={5}
              title="Review your order"
              open={step === 4}
              complete={false}
              onToggle={() => (furthest >= 4 ? goTo(4) : goTo(3))}
            >
              <ReviewStep
                contact={contact}
                address={address}
                quote={quote}
                paymentLabel={
                  paymentMethods.find((m) => m.id === payment.method)?.name ?? 'Payment'
                }
                cardLast4={payment.method === 'card' ? cardLast4 : null}
                onEdit={goTo}
                onPlaceOrder={placeOrder}
                placing={placing}
                error={placeError}
              />
            </CheckoutStep>
          </div>

          {/* Summary */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <OrderSummaryPanel
              quote={quote}
              loading={quoteLoading}
              error={quoteError}
              onRetry={requestQuote}
              placing={placing}
            >
              <div className={cx('t-caption space-y-2 text-muted')}>
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={1.6} aria-hidden />
                  Encrypted payment. 30-day returns on everything.
                </p>
                <p>
                  Delivering to {getCountry(address.country).name}
                </p>
              </div>

              {!quote && quoteLoading ? (
                <Button variant="primary-dark" size="xl" fullWidth loading disabled className="mt-5">
                  Preparing checkout
                </Button>
              ) : (
                <Button
                  to="/shop"
                  variant="outline-dark"
                  size="lg"
                  fullWidth
                  className="mt-5"
                >
                  Continue shopping
                </Button>
              )}
            </OrderSummaryPanel>
          </div>
        </div>
      </Container>
    </div>
  );
}