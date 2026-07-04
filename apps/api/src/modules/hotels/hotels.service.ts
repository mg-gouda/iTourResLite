import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { HotelWriteDto, RoomTypeWriteDto } from "@itour/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HotelsService {
  constructor(private prisma: PrismaService) {}

  list(q?: string) {
    return this.prisma.hotel.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      include: { resort: true, _count: { select: { roomTypes: true } } },
    });
  }

  async get(id: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: { resort: true, roomTypes: { orderBy: { name: "asc" } } },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  roomTypes(hotelId: string) {
    return this.prisma.hotelRoomType.findMany({
      where: { hotelId, active: true },
      orderBy: { name: "asc" },
    });
  }

  create(dto: HotelWriteDto) {
    return this.prisma.hotel.create({ data: dto });
  }

  update(id: string, dto: Partial<HotelWriteDto>) {
    return this.prisma.hotel.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const bookingCount = await this.prisma.booking.count({ where: { hotelId: id } });
    if (bookingCount > 0)
      throw new BadRequestException(`Cannot delete: hotel has ${bookingCount} booking(s). Archive it instead.`);
    await this.prisma.hotel.delete({ where: { id } });
    return { ok: true };
  }

  addRoomType(hotelId: string, dto: RoomTypeWriteDto) {
    return this.prisma.hotelRoomType.create({ data: { ...dto, hotelId } });
  }

  updateRoomType(rtId: string, dto: Partial<RoomTypeWriteDto>) {
    return this.prisma.hotelRoomType.update({ where: { id: rtId }, data: dto });
  }

  async removeRoomType(rtId: string) {
    await this.prisma.hotelRoomType.delete({ where: { id: rtId } });
    return { ok: true };
  }
}
