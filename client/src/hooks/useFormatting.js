const DEFAULT_CURRENCY = {
  code: 'USD',
  symbol: '$',
  locale: 'en-US',
};

/**
 * Global store presentation settings (currency / locale / markets).
 * Mock-backed for steps 1-10; swapped to the API in step 11.
 */
export default function useFormatting() {
  return DEFAULT_CURRENCY;
}

export { DEFAULT_CURRENCY };
