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
const CLUB_KEY = 'tj_club';

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

export interface Club { id: string; name: string; slug: string; }

/** ก๊วนที่ล็อกอินอยู่ตอนนี้ — เก็บคู่กับ token เสมอ (login ตั้งทั้งคู่, logout/401 ล้างทั้งคู่) */
export function getClub(): Club | null {
  const raw = sessionStorage.getItem(CLUB_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setClub(club: Club) {
  sessionStorage.setItem(CLUB_KEY, JSON.stringify(club));
}

export function clearClub() {
  sessionStorage.removeItem(CLUB_KEY);
}

/** fetch() wrapper that attaches the bearer token (when present) and reacts to 401s. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    clearClub();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * เวลาปัจจุบันจากเซิร์ฟเวอร์ — ใช้แทน Date.now() ของเครื่องลูกค้าตอนตัดสินใจว่า "วันนี้" คือวันไหน
 * (เช่นตอนเริ่ม session ใหม่) กันปัญหานาฬิกาเครื่องลูกค้าผิดแล้วข้อมูลไปลงผิดวัน
 * ถ้าเรียกเซิร์ฟเวอร์ไม่ได้ (เน็ตหลุดชั่วคราว) fallback เป็นเวลาเครื่อง ไม่บล็อก UI
 */
export async function getServerTime(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/time`);
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    if (typeof data.now === 'number') return data.now;
    throw new Error('bad payload');
  } catch (err) {
    console.warn('getServerTime failed, falling back to local clock:', err);
    return Date.now();
  }
}
