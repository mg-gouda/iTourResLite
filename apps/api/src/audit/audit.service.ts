import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    action: "CREATE" | "UPDATE" | "DELETE";
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: (params.before ?? undefined) as any,
        after: (params.after ?? undefined) as any,
      },
    });
  }
}
