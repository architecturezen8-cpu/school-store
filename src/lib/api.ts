/**
 * ------------------------------------------------------------------
 *  STORE API
 * ------------------------------------------------------------------
 *  Paste your database / backend base URL here when it is ready.
 *  While it is empty (or unreachable) the store renders local seed
 *  data from src/data.ts, so the site never breaks.
 *
 *  Expected endpoints (see database/schema.sql):
 *    GET  {BASE}/categories        -> Category[]
 *    GET  {BASE}/products          -> Product[]
 *    GET  {BASE}/products?category=badges
 *    GET  {BASE}/products/:slug    -> Product
 *    POST {BASE}/orders            -> { orderId }
 */
export const API_BASE_URL = ""; // e.g. "https://api.stcmatale.lk/v1"

const TIMEOUT_MS = 4000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new Error("API not configured");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  getCategories: <T>() => request<T[]>("/categories"),
  getProducts: <T>(category?: string) =>
    request<T[]>(`/products${category ? `?category=${category}` : ""}`),
  getProduct: <T>(slug: string) => request<T>(`/products/${slug}`),
  createOrder: <T>(body: unknown) =>
    request<T>("/orders", { method: "POST", body: JSON.stringify(body) }),
};

export const isApiLive = () => API_BASE_URL.length > 0;
