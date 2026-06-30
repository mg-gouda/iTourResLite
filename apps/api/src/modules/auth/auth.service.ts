import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { verifyPassword, type SessionUser } from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async validate(email: string, password: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.active) throw new UnauthorizedException("Invalid credentials");
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async sign(user: SessionUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      { secret: process.env.JWT_SECRET ?? "dev-secret", expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
    );
  }

  async me(id: string): Promise<SessionUser | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u && u.active ? { id: u.id, email: u.email, name: u.name, role: u.role } : null;
  }
}
