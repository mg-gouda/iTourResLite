import { Body, Controller, Get, Post, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { loginSchema } from "@itour/shared";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { Public } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { AUTH_COOKIE } from "../../common/jwt-auth.guard";
import type { SessionUser } from "@itour/shared";

const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validate(body.email, body.password);
    const token = await this.auth.sign(user);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: MAX_AGE,
      path: "/",
    });
    return { user };
  }

  @Public()
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentUser() user: SessionUser) {
    const fresh = await this.auth.me(user.id);
    if (!fresh) throw new UnauthorizedException();
    return { user: fresh };
  }
}
