import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { hotelWriteSchema, roomTypeWriteSchema } from "@itour/shared";
import { HotelsService } from "./hotels.service";
import { Roles } from "../../common/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("hotels")
export class HotelsController {
  constructor(private hotels: HotelsService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.hotels.list(q);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.hotels.get(id);
  }

  // Cascade source for the booking form (room types of the chosen hotel).
  @Get(":id/room-types")
  roomTypes(@Param("id") id: string) {
    return this.hotels.roomTypes(id);
  }

  @Post()
  @Roles("MANAGER")
  create(@Body(new ZodValidationPipe(hotelWriteSchema)) dto: any) {
    return this.hotels.create(dto);
  }

  @Patch(":id")
  @Roles("MANAGER")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(hotelWriteSchema.partial())) dto: any) {
    return this.hotels.update(id, dto);
  }

  @Delete(":id")
  @Roles("MANAGER")
  remove(@Param("id") id: string) {
    return this.hotels.remove(id);
  }

  @Post(":id/room-types")
  @Roles("MANAGER")
  addRoomType(@Param("id") id: string, @Body(new ZodValidationPipe(roomTypeWriteSchema)) dto: any) {
    return this.hotels.addRoomType(id, dto);
  }

  @Patch("room-types/:rtId")
  @Roles("MANAGER")
  updateRoomType(@Param("rtId") rtId: string, @Body(new ZodValidationPipe(roomTypeWriteSchema.partial())) dto: any) {
    return this.hotels.updateRoomType(rtId, dto);
  }

  @Delete("room-types/:rtId")
  @Roles("MANAGER")
  removeRoomType(@Param("rtId") rtId: string) {
    return this.hotels.removeRoomType(rtId);
  }
}
