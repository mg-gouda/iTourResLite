import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { LicenseService } from "./license.service";
import { Roles } from "../../common/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const activateSchema = z.object({ token: z.string().min(10) });

@Controller("license")
@Roles("ADMIN")
export class LicenseController {
  constructor(private license: LicenseService) {}

  @Get("status")
  status(@Query("force") force?: string) {
    return this.license.status(force === "true");
  }

  @Post("activate")
  activate(@Body(new ZodValidationPipe(activateSchema)) body: { token: string }) {
    return this.license.activate(body.token);
  }
}
