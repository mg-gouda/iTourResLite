import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { bookingQuerySchema, bookingUpdateSchema, bookingWriteSchema, type SessionUser } from "@itour/shared";
import { BookingsService } from "./bookings.service";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("bookings")
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(bookingQuerySchema)) q: any) {
    return this.bookings.list(q);
  }

  @Get("by-ref/:ref")
  byRef(@Param("ref") ref: string) {
    return this.bookings.byRef(ref);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.bookings.get(id);
  }

  @Post()
  @Roles("AGENT") // AGENT+ (Accountant excluded from create; can only edit financial fields).
  create(@Body(new ZodValidationPipe(bookingWriteSchema)) dto: any, @CurrentUser() user: SessionUser) {
    return this.bookings.create(dto, user);
  }

  @Patch(":id")
  @Roles("ACCOUNTANT") // ACCOUNTANT allowed but field-gated in service; AGENT+ full.
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bookingUpdateSchema)) dto: any,
    @CurrentUser() user: SessionUser,
  ) {
    return this.bookings.update(id, dto, user);
  }

  @Delete(":id")
  @Roles("MANAGER")
  remove(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    return this.bookings.remove(id, user);
  }
}
