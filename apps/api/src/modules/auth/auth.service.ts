import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type SessionUser } from "@itour/shared";
import { verifyPassword } from "../../common/password";
import { verifyTotp } from "../../common/totp";
import { PrismaService } from "../../prisma/prisma.service";

const JWT_SECRET = () => process.env.JWT_SECRET ?? "dev-secret";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async validate(email: string, password: string): Promise<{ user: SessionUser; requires2fa: boolean; preAuthToken?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.active) throw new UnauthorizedException("Invalid credentials");
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    if (user.twoFactorEnabled) {
      const preAuthToken = await this.jwt.signAsync(
        { sub: user.id, preAuth: true },
        { secret: JWT_SECRET(), expiresIn: "5m" as any },
      );
      return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, requires2fa: true, preAuthToken };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, requires2fa: false };
  }

  async verify2fa(preAuthToken: string, code: string): Promise<SessionUser> {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(preAuthToken, { secret: JWT_SECRET() });
    } catch {
      throw new UnauthorizedException("Invalid or expired pre-auth token");
    }
    if (!payload.preAuth) throw new UnauthorizedException("Invalid token type");

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException("2FA not set up");
    }
    if (!verifyTotp(code, user.twoFactorSecret)) throw new UnauthorizedException("Invalid 2FA code");

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async sign(user: SessionUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      { secret: JWT_SECRET(), expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as any },
    );
  }

  async me(id: string): Promise<(SessionUser & { twoFactorEnabled: boolean }) | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u && u.active ? { id: u.id, email: u.email, name: u.name, role: u.role, twoFactorEnabled: u.twoFactorEnabled } : null;
  }
}
