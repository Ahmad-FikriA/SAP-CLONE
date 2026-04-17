import { getToken, clearAuth } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Authorization: `Bearer ${getToken()}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function apiGet(path) {
  return apiFetch(path);
}

export function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(path, body) {
  return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}

/** POST with FormData (file uploads) — does not set Content-Type */
export function apiUpload(path, formData) {
  return apiFetch(path, { method: 'POST', body: formData });
}

/** GET that returns a Blob (for file downloads) */
export async function apiBlob(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.blob();
}
