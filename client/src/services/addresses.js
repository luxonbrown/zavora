/**
 * Address book (mock for steps 1-10).
 * Step 11 replaces the in-memory list with the `addresses` table.
 */
import api from './api.js';
import { readStore, writeStore } from '../utils/storage.js';

import { USE_MOCK } from './env';
const STORAGE_KEY = 'addresses';

const SEED = [
  {
    id: 'adr_1',
    label: 'Home',
    isDefault: true,
    firstName: 'Alex',
    lastName: 'Moreau',
    phone: '+1 555 000 1234',
    country: 'US',
    state: 'California',
    city: 'San Francisco',
    address1: '1200 Market Street',
    address2: 'Apt 4B',
    postalCode: '94103',
  },
  {
    id: 'adr_2',
    label: 'Office',
    isDefault: false,
    firstName: 'Alex',
    lastName: 'Moreau',
    phone: '+1 555 000 1234',
    country: 'DE',
    state: 'Berlin',
    city: 'Berlin',
    address1: 'Torstrasse 1',
    address2: '',
    postalCode: '10119',
  },
];

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function read() {
  const stored = readStore(STORAGE_KEY, null);
  return Array.isArray(stored) && stored.length ? stored : SEED;
}

function write(list) {
  writeStore(STORAGE_KEY, list);
  return list;
}

/**
 * Always returns a plain ARRAY.
 *
 * The real API answers `GET /addresses` with `{ ok, items }` and the create /
 * update endpoints with `{ ok, address }`, while the mock branch returns the
 * whole stored array. Callers were therefore doing `.map` on an envelope in real
 * mode and silently rendering nothing. Unwrapping here keeps one contract.
 */
export const addressesService = {
  /** @returns {Promise<Array>} */
  async list() {
    if (USE_MOCK) {
      await delay();
      return read();
    }
    const { data } = await api.get('/addresses');
    return data?.items ?? [];
  },

  /** @returns {Promise<Array>} the full list after the write. */
  async create(address) {
    if (USE_MOCK) {
      await delay();
      const list = read();
      // First address becomes the default automatically.
      const isDefault = list.length === 0 ? true : Boolean(address.isDefault);
      const next = [
        ...list.map((a) => (isDefault ? { ...a, isDefault: false } : a)),
        {
          ...address,
          id: `adr_${Date.now().toString(36)}`,
          isDefault,
        },
      ];
      return write(next);
    }
    await api.post('/addresses', address);
    // Re-read rather than synthesise a row: the server owns ids and defaults.
    return this.list();
  },

  /** @returns {Promise<Array>} the full list after the write. */
  async update(id, patch) {
    if (USE_MOCK) {
      await delay();
      const list = read();
      const next = list.map((a) => {
        if (a.id !== id) return patch.isDefault ? { ...a, isDefault: false } : a;
        return { ...a, ...patch };
      });
      return write(next);
    }
    await api.patch(`/addresses/${id}`, patch);
    return this.list();
  },

  /** @returns {Promise<Array>} the full list after the write. */
  async remove(id) {
    if (USE_MOCK) {
      await delay();
      const list = read().filter((a) => a.id !== id);
      // Never leave the book without a default.
      if (list.length && !list.some((a) => a.isDefault)) list[0] = { ...list[0], isDefault: true };
      return write(list);
    }
    await api.delete(`/addresses/${id}`);
    return this.list();
  },

  async setDefault(id) {
    return this.update(id, { isDefault: true });
  },
};

export default addressesService;