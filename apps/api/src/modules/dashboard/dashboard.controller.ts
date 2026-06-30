import { Controller, Get, Query } from "@nestjs/common";
import { dashboardQuerySchema, breakdownQuerySchema } from "@itour/shared";
import { DashboardService } from "./dashboard.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("dashboard")
export class DashboardController {
  constructor(private dash: DashboardService) {}

  @Get("overview")
  overview(@Query(new ZodValidationPipe(dashboardQuerySchema)) q: any) {
    return this.dash.overview(q);
  }

  @Get("pl")
  pl(@Query(new ZodValidationPipe(dashboardQuerySchema)) q: any) {
    return this.dash.pl(q);
  }

  @Get("breakdowns")
  breakdowns(@Query(new ZodValidationPipe(breakdownQuerySchema)) q: any) {
    return this.dash.breakdowns(q);
  }
}
