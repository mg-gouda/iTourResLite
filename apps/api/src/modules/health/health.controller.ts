import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/roles.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    let db = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return { status: db === "up" ? "ok" : "degraded", db, ts: new Date().toISOString() };
  }
}
