import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../common/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("audit-log")
@Roles("ADMIN")
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) };
  }
}
