import { Injectable } from "@nestjs/common";
import { checkLicense, makeInstallId, decodeToken, type CheckLicenseResult, type TokenPayload } from "../../common/license-verify";
import { PrismaService } from "../../prisma/prisma.service";

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class LicenseService {
  private _cache: { result: CheckLicenseResult; payload: TokenPayload | null; at: number } | null = null;

  constructor(private prisma: PrismaService) {}

  private async cfg(key: string): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async setCfg(key: string, value: string) {
    await this.prisma.systemConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  private async ensureInstallId(): Promise<string> {
    let id = await this.cfg("licenseInstallId");
    if (!id) { id = makeInstallId(); await this.setCfg("licenseInstallId", id); }
    return id;
  }

  async status(force = false): Promise<{ result: CheckLicenseResult; payload: TokenPayload | null }> {
    const now = Date.now();
    if (!force && this._cache && now - this._cache.at < CACHE_TTL_MS) {
      return { result: this._cache.result, payload: this._cache.payload };
    }

    const token = await this.cfg("licenseKey");
    const publicKeyPem = process.env.LICENSE_PUBLIC_KEY ?? "";
    const hostname = process.env.APP_HOST ?? "localhost";
    const serverUrl = process.env.LICENSE_SERVER_URL ?? "";

    if (!token || !publicKeyPem) {
      const result: CheckLicenseResult = { ok: false, status: "invalid" };
      this._cache = { result, payload: null, at: now };
      return { result, payload: null };
    }

    const installId = await this.ensureInstallId();
    const lastGoodStr = await this.cfg("licenseLastCheck");
    const lastGoodCheck = lastGoodStr ? Number(lastGoodStr) : undefined;

    const result = await checkLicense({ token, publicKeyPem, hostname, serverUrl, installId, lastGoodCheck });

    if (result.refreshedToken) await this.setCfg("licenseKey", result.refreshedToken);
    if (result.nextLastGoodCheck) await this.setCfg("licenseLastCheck", String(result.nextLastGoodCheck));

    const payload = decodeToken(result.refreshedToken ?? token);
    this._cache = { result, payload, at: now };
    return { result, payload };
  }

  async activate(token: string): Promise<{ result: CheckLicenseResult; payload: TokenPayload | null }> {
    await this.setCfg("licenseKey", token);
    await this.prisma.systemConfig.deleteMany({ where: { key: "licenseLastCheck" } });
    this._cache = null;
    return this.status(true);
  }
}
