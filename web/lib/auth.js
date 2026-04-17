'use client';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Checks token presence and expiry (client-side decode, no signature check).
 * Returns true if valid, false if missing or expired.
 */
export function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuth();
      return false;
    }
    return true;
  } catch {
    clearAuth();
    return false;
  }
}
