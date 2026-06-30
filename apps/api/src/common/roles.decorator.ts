import { SetMetadata } from "@nestjs/common";
import type { Role } from "@itour/shared";

export const ROLES_KEY = "roles";
// Minimum role(s). A single role means "this rank or higher" (see RolesGuard).
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(PUBLIC_KEY, true);
