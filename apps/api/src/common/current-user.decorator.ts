import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { SessionUser } from "@itour/shared";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
