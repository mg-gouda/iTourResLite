import {
  Controller, Get, Put, Delete, Param, Body, Query,
} from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import type { SessionUser } from "@itour/shared";
import type { Role, Permission } from "@itour/shared";

interface SetPermBody { permission: string; granted: boolean | null }

@Controller("permissions")
export class PermissionsController {
  constructor(private svc: PermissionsService) {}

  /** My effective permissions (all authenticated users) */
  @Get("me")
  @Roles("VIEWER")
  async me(@CurrentUser() user: SessionUser) {
    return this.svc.resolve(user.id, user.role as Role);
  }

  /** Full matrix (effective per role) for the admin UI */
  @Get("matrix")
  @Roles("ADMIN")
  matrix() {
    return this.svc.getRoleMatrix();
  }

  /** Raw role overrides (for diff display in UI) */
  @Get("role-overrides")
  @Roles("ADMIN")
  roleOverrides() {
    return this.svc.getRoleOverrides();
  }

  /** Set or clear a role-level override. granted=null clears override. */
  @Put("role/:role")
  @Roles("ADMIN")
  setRole(
    @Param("role") role: string,
    @Body() body: SetPermBody,
  ) {
    return this.svc.setRolePermission(role as Role, body.permission as Permission, body.granted);
  }

  /** Reset a role to pure defaults */
  @Delete("role/:role")
  @Roles("ADMIN")
  resetRole(@Param("role") role: string) {
    return this.svc.resetRolePermissions(role as Role);
  }

  /** User-level overrides for a specific user */
  @Get("user/:userId")
  @Roles("ADMIN")
  userOverrides(@Param("userId") userId: string) {
    return this.svc.getUserOverrides(userId);
  }

  /** Set or clear a user-level override */
  @Put("user/:userId")
  @Roles("ADMIN")
  setUser(
    @Param("userId") userId: string,
    @Body() body: SetPermBody,
  ) {
    return this.svc.setUserPermission(userId, body.permission as Permission, body.granted);
  }

  /** Reset all user-level overrides */
  @Delete("user/:userId")
  @Roles("ADMIN")
  resetUser(@Param("userId") userId: string) {
    return this.svc.resetUserPermissions(userId);
  }
}
