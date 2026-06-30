import { Module } from "@nestjs/common";
import { StopSalesController } from "./stop-sales.controller";

@Module({ controllers: [StopSalesController] })
export class StopSalesModule {}
