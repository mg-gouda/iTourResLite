import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { lookupWriteSchema } from "@itour/shared";
import { Roles, Public } from "../../common/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { PrismaService } from "../../prisma/prisma.service";

// Admin-maintained reference tables (System Parameters §6.6).
// One factory fn, same CRUD shape for all lookup entities.
type LookupEntity =
  | "tourOperator"
  | "market"
  | "resort"
  | "bookingStatusLookup"
  | "roomCategoryLookup"
  | "mealBasisLookup"
  | "paymentMethodLookup"
  | "currencyLookup"
  | "spoLookup";

const BY_SORT_ORDER = [{ sortOrder: "asc" }, { code: "asc" }];
const BY_CODE       = [{ code: "asc" }];

function crud(entity: LookupEntity, path: string, orderBy = BY_SORT_ORDER) {
  @Controller(path)
  class ParamCrud {
    constructor(public prisma: PrismaService) {}

    @Get()
    list() {
      return (this.prisma as any)[entity].findMany({ orderBy });
    }

    @Post()
    @Roles("MANAGER")
    create(@Body(new ZodValidationPipe(lookupWriteSchema)) dto: any) {
      return (this.prisma as any)[entity].create({ data: dto });
    }

    @Patch(":id")
    @Roles("MANAGER")
    update(@Param("id") id: string, @Body(new ZodValidationPipe(lookupWriteSchema.partial())) dto: any) {
      return (this.prisma as any)[entity].update({ where: { id }, data: dto });
    }

    @Delete(":id")
    @Roles("MANAGER")
    async remove(@Param("id") id: string) {
      await (this.prisma as any)[entity].delete({ where: { id } });
      return { ok: true };
    }
  }
  return ParamCrud;
}

// ---- System Config (key-value settings) ----
@Controller("system-config")
export class SystemConfigController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get("company-name")
  async getCompanyName() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: "companyName" } });
    return { companyName: row?.value ?? "" };
  }

  @Get()
  async getAll() {
    const rows = await this.prisma.systemConfig.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  @Patch()
  @Roles("ADMIN")
  async patch(@Body() body: Record<string, string>) {
    const ops = Object.entries(body).map(([key, value]) =>
      this.prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } }),
    );
    await Promise.all(ops);
    return { ok: true };
  }
}

export const TourOperatorsController    = crud("tourOperator",         "tour-operators",            BY_CODE);
export const MarketsController          = crud("market",               "markets",                   BY_CODE);
export const ResortsController          = crud("resort",               "resorts",                   BY_CODE);
export const BookingStatusesController  = crud("bookingStatusLookup",  "params/booking-statuses");
export const RoomCategoriesController   = crud("roomCategoryLookup",   "params/room-categories");
export const MealBasesController        = crud("mealBasisLookup",      "params/meal-bases");
export const PaymentMethodsController   = crud("paymentMethodLookup",  "params/payment-methods");
export const CurrenciesController       = crud("currencyLookup",       "params/currencies");
export const SposController             = crud("spoLookup",            "params/spos");
