import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as QRCode from "qrcode";
import { hashPassword, verifyPassword } from "../../common/password";
import { generateTotpSecret, makeOtpauthUri, verifyTotp } from "../../common/totp";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Current password is incorrect");
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new BadRequestException("2FA is already enabled");
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
    const uri = makeOtpauthUri(secret, user.email);
    // Render the otpauth URI as a scannable QR code (PNG data URL).
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return { secret, uri, qrDataUrl };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException("Run setup first");
    if (!verifyTotp(code, user.twoFactorSecret)) throw new BadRequestException("Invalid code");
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { ok: true };
  }

  async disable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new BadRequestException("2FA is not enabled");
    if (!verifyTotp(code, user.twoFactorSecret)) throw new BadRequestException("Invalid code");
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
    return { ok: true };
  }
}
