import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasRole, type Role } from "@itour/shared";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException("No user context");

    // Pass if the user meets the rank of ANY listed role (lowest listed = threshold).
    const ok = required.some((r) => hasRole(user.role, r));
    if (!ok) throw new ForbiddenException("Insufficient role");
    return true;
  }
}
