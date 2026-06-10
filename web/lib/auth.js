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

export function getPermissions() {
  return getUser()?.permissions ?? null; // null = unrestricted
}

export function canDo(page, op) {
  const p = getPermissions();
  if (!p) return true; // null = unrestricted
  return Array.isArray(p[page]) && p[page].includes(op);
}

export const canRead   = (page) => canDo(page, 'R');
export const canCreate = (page) => canDo(page, 'C');
export const canUpdate = (page) => canDo(page, 'U');
export const canDelete = (page) => canDo(page, 'D');

// Maps user.group → SPK category (mirrors backend GROUP_TO_CATEGORY)
const GROUP_TO_CATEGORY = {
  Mekanik: 'Mekanik',
  Elektrik: 'Listrik',
  Sipil:    'Sipil',
  Otomasi:  'Otomasi',
};

/**
 * Returns the SPK category this user is scoped to, or null if unrestricted.
 * Kasie: always scoped by their group.
 * Kadis: scoped by group unless their dinas is Pusat Perawatan.
 */
export function getUserCategory() {
  const user = getUser();
  if (!user) return null;
  const { role, group, dinas } = user;
  const isPuratPerawatan = role === 'kadis' && dinas?.toLowerCase().includes('pusat perawatan');
  if (role !== 'kasie' && (role !== 'kadis' || isPuratPerawatan)) return null;
  return GROUP_TO_CATEGORY[group] ?? null;
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
