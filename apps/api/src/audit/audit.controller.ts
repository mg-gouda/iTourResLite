import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../common/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { auditQuerySchema } from "@itour/shared";

@Controller("audit-log")
@Roles("ADMIN")
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(auditQuerySchema)) q: any) {
    const where: any = {};
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = q.from;
      if (q.to) where.createdAt.lte = q.to;
    }
    if (q.userId) where.userId = q.userId;
    if (q.entity) where.entity = q.entity;
    if (q.action) where.action = q.action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) };
  }
}
