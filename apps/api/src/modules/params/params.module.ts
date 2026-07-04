import { Module } from "@nestjs/common";
import { LookupsController } from "../lookups/lookups.controller";
import {
  TourOperatorsController, MarketsController, ResortsController,
  BookingStatusesController, RoomCategoriesController, MealBasesController,
  PaymentMethodsController, CurrenciesController, SposController,
  SystemConfigController,
} from "./params.controller";

@Module({
  controllers: [
    LookupsController,
    TourOperatorsController, MarketsController, ResortsController,
    BookingStatusesController, RoomCategoriesController, MealBasesController,
    PaymentMethodsController, CurrenciesController, SposController,
    SystemConfigController,
  ],
})
export class ParamsModule {}
