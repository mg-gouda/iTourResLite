import { Module } from "@nestjs/common";
import { LookupsController } from "../lookups/lookups.controller";
import { TourOperatorsController, MarketsController, ResortsController } from "./params.controller";

@Module({
  controllers: [LookupsController, TourOperatorsController, MarketsController, ResortsController],
})
export class ParamsModule {}
