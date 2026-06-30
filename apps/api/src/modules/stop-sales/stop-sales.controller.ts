import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { stopSaleWriteSchema } from "@itour/shared";
import { Roles } from "../../common/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("stop-sales")
export class StopSalesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query("hotelId") hotelId?: string) {
    return this.prisma.stopSale.findMany({
      where: hotelId ? { hotelId } : undefined,
      orderBy: { fromDate: "desc" },
      include: {
        hotel: { select: { id: true, name: true } },
        hotelRoomType: { select: { id: true, name: true } },
      },
    });
  }

  @Post()
  @Roles("MANAGER")
  create(@Body(new ZodValidationPipe(stopSaleWriteSchema)) dto: any) {
    return this.prisma.stopSale.create({ data: dto });
  }

  @Patch(":id")
  @Roles("MANAGER")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(stopSaleWriteSchema)) dto: any) {
    return this.prisma.stopSale.update({ where: { id }, data: dto });
  }

  @Delete(":id")
  @Roles("MANAGER")
  async remove(@Param("id") id: string) {
    await this.prisma.stopSale.delete({ where: { id } });
    return { ok: true };
  }
}
