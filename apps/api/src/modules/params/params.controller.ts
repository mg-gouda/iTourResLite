import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { lookupWriteSchema } from "@itour/shared";
import { Roles } from "../../common/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

// Admin-maintained reference tables (System Parameters §6.6).
// One controller, three entities — identical CRUD shape.
function crud(entity: "tourOperator" | "market" | "resort", path: string) {
  @Controller(path)
  class ParamCrud {
    constructor(public prisma: PrismaService) {}

    @Get()
    list() {
      return (this.prisma as any)[entity].findMany({ orderBy: { code: "asc" } });
    }

    @Post()
    @Roles("ADMIN")
    create(@Body(new ZodValidationPipe(lookupWriteSchema)) dto: any) {
      return (this.prisma as any)[entity].create({ data: dto });
    }

    @Patch(":id")
    @Roles("ADMIN")
    update(@Param("id") id: string, @Body(new ZodValidationPipe(lookupWriteSchema.partial())) dto: any) {
      return (this.prisma as any)[entity].update({ where: { id }, data: dto });
    }

    @Delete(":id")
    @Roles("ADMIN")
    async remove(@Param("id") id: string) {
      await (this.prisma as any)[entity].delete({ where: { id } });
      return { ok: true };
    }
  }
  return ParamCrud;
}

export const TourOperatorsController = crud("tourOperator", "tour-operators");
export const MarketsController = crud("market", "markets");
export const ResortsController = crud("resort", "resorts");
