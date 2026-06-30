import { Module } from "@nestjs/common";
import { MaterializationService } from "./materialization.service";
import { MaterializationController } from "./materialization.controller";

@Module({
  providers: [MaterializationService],
  controllers: [MaterializationController],
  exports: [MaterializationService],
})
export class MaterializationModule {}
