/**
 * MG License client — implements the contract from the hand-off doc.
 * Zero dependencies: Node built-in `crypto` + global `fetch` (Node 18+).
 */
import { createVerify, randomUUID } from "node:crypto";

export interface CheckLicenseOptions {
  token: string;
  publicKeyPem: string;
  hostname: string;
  serverUrl: string;
  installId: string;
  lastGoodCheck?: number;
  onlineEveryMs?: number;
  unreachableGraceDays?: number;
  expiryGraceDays?: number;
}

export type LicenseStatus =
  | "active" | "grace" | "expired" | "revoked" | "invalid"
  | "domain_mismatch" | "install_blocked" | "ip_mismatch" | "grace_expired";

export interface CheckLicenseResult {
  ok: boolean;
  status: LicenseStatus;
  expiresAt?: number;
  refreshedToken?: string;
  nextLastGoodCheck?: number;
}

export interface TokenPayload {
  jti: string; tid: string; iss: string; product: string; tenant: string;
  domains: string[]; ips?: string[]; maxInstalls: number; plan: string;
  features?: string[]; iat: number; exp: number; ver: number;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function verifySignature(token: string, publicKeyPem: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const data = `${parts[0]}.${parts[1]}`;
    const sig = b64urlDecode(parts[2]);
    return createVerify("ed25519").update(data).verify(publicKeyPem, sig);
  } catch { return false; }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(b64urlDecode(parts[1]).toString("utf8")) as TokenPayload;
  } catch { return null; }
}

function domainMatches(hostname: string, domains: string[]): boolean {
  const h = hostname.toLowerCase().replace(/:\d+$/, "");
  return domains.some((d) => d === "*" || d.toLowerCase() === h || h.endsWith("." + d.toLowerCase()));
}

export function makeInstallId(): string {
  return randomUUID();
}

export async function checkLicense(opts: CheckLicenseOptions): Promise<CheckLicenseResult> {
  const {
    token, publicKeyPem, hostname, serverUrl, installId, lastGoodCheck,
    onlineEveryMs = 24 * 60 * 60 * 1000,
    unreachableGraceDays = 7,
    expiryGraceDays = 7,
  } = opts;

  const now = Date.now();

  if (!verifySignature(token, publicKeyPem)) return { ok: false, status: "invalid" };
  const payload = decodeToken(token);
  if (!payload || payload.iss !== "MGLicenses") return { ok: false, status: "invalid" };

  if (!domainMatches(hostname, payload.domains)) return { ok: false, status: "domain_mismatch" };

  const expMs = payload.exp * 1000;
  const expired = now > expMs;
  if (now > expMs + expiryGraceDays * 24 * 60 * 60 * 1000) return { ok: false, status: "expired", expiresAt: payload.exp };

  const needsOnline = !lastGoodCheck || now - lastGoodCheck > onlineEveryMs;
  if (needsOnline) {
    try {
      const res = await fetch(`${serverUrl}/api/v1/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, installId, hostname }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const hb = await res.json() as any;
        const nextLastGoodCheck = now;
        if (!hb.valid || hb.revoked) return { ok: false, status: "revoked", expiresAt: hb.expiresAt, nextLastGoodCheck };
        if (hb.expired) return { ok: false, status: "expired", expiresAt: hb.expiresAt, nextLastGoodCheck };
        if (hb.installBlocked) return { ok: false, status: "install_blocked", expiresAt: hb.expiresAt, nextLastGoodCheck };
        if (hb.ipBlocked) return { ok: false, status: "ip_mismatch", expiresAt: hb.expiresAt, nextLastGoodCheck };
        return {
          ok: true, status: expired ? "grace" : "active", expiresAt: hb.expiresAt,
          refreshedToken: hb.refreshedToken, nextLastGoodCheck,
        };
      }
    } catch { /* server unreachable */ }

    // Server unreachable → offline grace
    if (lastGoodCheck && now - lastGoodCheck > unreachableGraceDays * 24 * 60 * 60 * 1000) {
      return { ok: false, status: "grace_expired" };
    }
    return { ok: true, status: "grace", expiresAt: payload.exp };
  }

  return { ok: true, status: expired ? "grace" : "active", expiresAt: payload.exp };
}
