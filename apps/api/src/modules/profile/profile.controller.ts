import { Body, Controller, Post, Get } from "@nestjs/common";
import { changePasswordSchema, verifyTotpSchema } from "@itour/shared";
import { ProfileService } from "./profile.service";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { SessionUser } from "@itour/shared";

@Controller("profile")
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Post("password")
  changePassword(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string },
  ) {
    return this.profile.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Get("2fa/setup")
  setup2fa(@CurrentUser() user: SessionUser) {
    return this.profile.setup2fa(user.id);
  }

  @Post("2fa/enable")
  enable2fa(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(verifyTotpSchema)) body: { code: string },
  ) {
    return this.profile.enable2fa(user.id, body.code);
  }

  @Post("2fa/disable")
  disable2fa(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(verifyTotpSchema)) body: { code: string },
  ) {
    return this.profile.disable2fa(user.id, body.code);
  }
}
