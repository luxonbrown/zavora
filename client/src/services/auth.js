/**
 * Authentication service.
 *
 * Steps 1-10 resolve against an in-memory mock; step 11 flips `USE_MOCK` and
 * every call goes over the cookie session. The AuthContext never knows which.
 * Password hashing (bcrypt) happens server-side only — never here.
 */
import api from './api.js';
import {
  passwordStrength,
  validateEmail,
  validatePassword,
} from '../utils/validation.js';

import { USE_MOCK } from './env';

/** Demo account surfaced on the login page so the flow is testable. */
export const DEMO_CREDENTIALS = {
  email: 'demo@zavora.com',
  password: 'zavora1234',
};

/**
 * The seeded administrator. Both are development accounts created by
 * `npm run db:seed`; neither exists in a real deployment, so they are surfaced
 * on the login page purely as a local convenience.
 */
export const ADMIN_CREDENTIALS = {
  email: 'admin@zavora.com',
  password: 'zavora-admin-2026',
};

function delay(ms = 550) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-exported so callers have one obvious place to reach for auth validation.
export { passwordStrength, validateEmail, validatePassword };

/** Accounts the mock has "seen" — lets Register detect a duplicate email. */
const registeredEmails = new Set([DEMO_CREDENTIALS.email]);

function mockUser(email, firstName = 'Alex', lastName = 'Moreau') {
  return {
    id: 'usr_demo_1',
    email,
    firstName,
    lastName,
    role: 'customer',
  };
}

export const authService = {
  async login({ email, password, remember = false }) {
    if (USE_MOCK) {
      await delay();
      const emailError = validateEmail(email);
      if (emailError) throw new Error(emailError);
      if (validatePassword(password)) throw new Error('Invalid email or password.');
      // The demo account enforces a real password so the failure path is
      // reachable; any other address works with any valid-length password.
      if (
        email.trim().toLowerCase() === DEMO_CREDENTIALS.email &&
        password !== DEMO_CREDENTIALS.password
      ) {
        throw new Error('Invalid email or password.');
      }
      return mockUser(email.trim());
    }

    const { data } = await api.post('/auth/login', { email, password, remember });
    return data.user;
  },

  async register({ firstName, lastName, email, password }) {
    if (USE_MOCK) {
      await delay(650);
      if (!firstName?.trim()) throw new Error('Enter your first name.');
      if (!lastName?.trim()) throw new Error('Enter your last name.');
      const emailError = validateEmail(email);
      if (emailError) throw new Error(emailError);
      const passwordError = validatePassword(password);
      if (passwordError) throw new Error(passwordError);

      const normalised = email.trim().toLowerCase();
      if (registeredEmails.has(normalised)) {
        throw new Error('An account with this email already exists.');
      }
      registeredEmails.add(normalised);
      return mockUser(email.trim(), firstName.trim(), lastName.trim());
    }

    const { data } = await api.post('/auth/register', { firstName, lastName, email, password });
    return data.user;
  },

  async requestPasswordReset(email) {
    if (USE_MOCK) {
      await delay(600);
      const emailError = validateEmail(email);
      if (emailError) throw new Error(emailError);
      return { sent: true };
    }
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async logout() {
    if (USE_MOCK) {
      await delay(200);
      return true;
    }
    await api.post('/auth/logout');
    return true;
  },

  /** Current session user, or null. Step 11 reads the session cookie. */
  async me() {
    if (USE_MOCK) return null;
    try {
      const { data } = await api.get('/auth/me');
      return data.user;
    } catch {
      return null;
    }
  },
};

export default authService;