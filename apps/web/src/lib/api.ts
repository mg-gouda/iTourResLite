// Typed fetch client. Browser-only data access with credentials so the
// httpOnly itour_session cookie is sent cross-port to the API.

export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const env = body as { error?: { message?: string; code?: string; details?: unknown } } | undefined;
    const message =
      env?.error?.message ??
      (typeof body === "string" && body ? body : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, env?.error?.code, env?.error?.details);
  }

  return body as T;
}

export const get = <T>(path: string, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: "GET" });

export const post = <T>(path: string, data?: unknown, init?: RequestInit) =>
  apiFetch<T>(path, {
    ...init,
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });

export const patch = <T>(path: string, data?: unknown, init?: RequestInit) =>
  apiFetch<T>(path, {
    ...init,
    method: "PATCH",
    body: data === undefined ? undefined : JSON.stringify(data),
  });

export const del = <T>(path: string, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: "DELETE" });

/** Build a query string from a params object, dropping empty values. */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
