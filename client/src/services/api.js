import axios from 'axios';

/**
 * Single axios instance. Auth is a cookie session (`withCredentials`), never a
 * token in a header or in the bundle.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Fired when the API rejects a request because the session is gone or expired.
 * AuthContext listens for this and signs the customer out with an explanation,
 * rather than leaving the UI in a half-authenticated state.
 */
export const SESSION_EXPIRED_EVENT = 'zavora:session-expired';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.error ||
      (status ? `Request failed (${status})` : 'Network error');

    if (status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.original = error;
    return Promise.reject(wrapped);
  }
);

export default api;
