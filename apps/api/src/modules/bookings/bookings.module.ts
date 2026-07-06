import { Module } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { BookingFinanceService } from "./booking-finance.service";
import { BookingFinanceController } from "./booking-finance.controller";

@Module({
  providers: [BookingsService, BookingFinanceService],
  controllers: [BookingsController, BookingFinanceController],
})
export class BookingsModule {}
