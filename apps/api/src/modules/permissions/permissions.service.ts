import { Injectable } from "@nestjs/common";
import {
  PERMISSIONS, DEFAULT_MATRIX, resolvePermissions,
  type Permission, type PermOverride,
} from "@itour/shared";
import type { Role } from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";

// 5-min per-user resolved permissions cache
const CACHE = new Map<string, { ts: number; result: Record<Permission, boolean> }>();
const TTL = 5 * 60 * 1000;

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  // ── Full matrix for admin UI ─────────────────────────────────────────────

  async getRoleMatrix(): Promise<Record<string, Record<Permission, boolean>>> {
    const overrides = await this.prisma.rolePermission.findMany();
    const matrix: Record<string, Record<Permission, boolean>> = {};
    const ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT", "ACCOUNTANT", "VIEWER"];
    for (const role of ROLES) {
      const roleOvr = overrides.filter((o) => o.role === role).map((o) => ({ permission: o.permission, granted: o.granted }));
      matrix[role] = resolvePermissions(role, roleOvr, []);
    }
    return matrix;
  }

  async getRoleOverrides(): Promise<Record<string, { permission: string; granted: boolean }[]>> {
    const rows = await this.prisma.rolePermission.findMany();
    const result: Record<string, { permission: string; granted: boolean }[]> = {};
    for (const r of rows) {
      (result[r.role] ??= []).push({ permission: r.permission, granted: r.granted });
    }
    return result;
  }

  async setRolePermission(role: Role, permission: Permission, granted: boolean | null) {
    if (granted === null) {
      await this.prisma.rolePermission.deleteMany({ where: { role, permission } });
    } else {
      await this.prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission, granted },
        update: { granted },
      });
    }
    this.invalidateRoleCache(role);
    return { ok: true };
  }

  async resetRolePermissions(role: Role) {
    await this.prisma.rolePermission.deleteMany({ where: { role } });
    this.invalidateRoleCache(role);
    return { ok: true };
  }

  // ── User-level overrides ─────────────────────────────────────────────────

  async getUserOverrides(userId: string): Promise<PermOverride[]> {
    const rows = await this.prisma.userPermission.findMany({ where: { userId } });
    return rows.map((r) => ({ permission: r.permission, granted: r.granted }));
  }

  async setUserPermission(userId: string, permission: Permission, granted: boolean | null) {
    if (granted === null) {
      await this.prisma.userPermission.deleteMany({ where: { userId, permission } });
    } else {
      await this.prisma.userPermission.upsert({
        where: { userId_permission: { userId, permission } },
        create: { userId, permission, granted },
        update: { granted },
      });
    }
    CACHE.delete(userId);
    return { ok: true };
  }

  async resetUserPermissions(userId: string) {
    await this.prisma.userPermission.deleteMany({ where: { userId } });
    CACHE.delete(userId);
    return { ok: true };
  }

  // ── Effective resolution ─────────────────────────────────────────────────

  async resolve(userId: string, role: Role): Promise<Record<Permission, boolean>> {
    const cached = CACHE.get(userId);
    if (cached && Date.now() - cached.ts < TTL) return cached.result;

    const [roleOvr, userOvr] = await Promise.all([
      this.prisma.rolePermission.findMany({ where: { role } }),
      this.prisma.userPermission.findMany({ where: { userId } }),
    ]);

    const result = resolvePermissions(
      role,
      roleOvr.map((r) => ({ permission: r.permission, granted: r.granted })),
      userOvr.map((r) => ({ permission: r.permission, granted: r.granted })),
    );
    CACHE.set(userId, { ts: Date.now(), result });
    return result;
  }

  invalidate(userId: string) {
    CACHE.delete(userId);
  }

  private invalidateRoleCache(role: Role) {
    // Evict all cached users of this role (brute-force — small cache)
    CACHE.clear();
  }

  // Quick single-permission check (used by guard)
  async can(userId: string, role: Role, permission: Permission): Promise<boolean> {
    if (role === "ADMIN") return true;
    const resolved = await this.resolve(userId, role);
    return resolved[permission] === true;
  }
}
