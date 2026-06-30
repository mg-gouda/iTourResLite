import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PUBLIC_KEY } from "./roles.decorator";

export const AUTH_COOKIE = "itour_session";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[AUTH_COOKIE] ?? bearer(req);
    if (!token) throw new UnauthorizedException("Not authenticated");

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET ?? "dev-secret" });
      (req as any).user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
}
