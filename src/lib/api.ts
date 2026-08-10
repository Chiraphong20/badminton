// Shared helper for talking to protected /api/* routes.
//
// The login PIN is verified server-side (see backend/server.js) and exchanged
// for a signed bearer token. The token lives in sessionStorage (cleared when
// the tab closes, same lifetime the old client-only "tj_auth" flag had) and
// every request attaches it. If the server ever says 401 — token missing,
// expired, or the server restarted with a fresh secret — we drop it and
// broadcast AUTH_EXPIRED_EVENT so the app can fall back to the login screen
// instead of failing silently or looping on bad requests.

const TOKEN_KEY = 'tj_token';

export const AUTH_EXPIRED_EVENT = 'smashpang:auth-expired';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** fetch() wrapper that attaches the bearer token (when present) and reacts to 401s. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}
