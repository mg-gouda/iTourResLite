import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type UserCreateDto, type UserUpdateDto } from "@itour/shared";
import { hashPassword } from "../../common/password";
import { PrismaService } from "../../prisma/prisma.service";

const SAFE = { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ select: SAFE, orderBy: { createdAt: "asc" } });
  }

  async create(dto: UserCreateDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException("Email already in use");
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.user.create({
      data: { email, name: dto.name, role: dto.role, active: dto.active, passwordHash },
      select: SAFE,
    });
  }

  async update(id: string, dto: UserUpdateDto) {
    await this.ensure(id);
    return this.prisma.user.update({ where: { id }, data: dto, select: SAFE });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.user.update({ where: { id }, data: { active: false } }); // deactivate (soft)
    return { ok: true };
  }

  // Permanently delete a user. Detaches history (bookings/audit → null),
  // cascades per-user permission overrides, and blocks self-deletion.
  async hardRemove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new ForbiddenException("You cannot delete your own account.");
    await this.ensure(id);
    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId: id } }),
      this.prisma.booking.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      this.prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  async resetPassword(id: string, password: string) {
    await this.ensure(id);
    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  private async ensure(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException("User not found");
  }
}
