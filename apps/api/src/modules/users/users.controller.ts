import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { userCreateSchema, userUpdateSchema, resetPasswordSchema, type SessionUser } from "@itour/shared";
import { UsersService } from "./users.service";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("users")
@Roles("ADMIN")
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(userCreateSchema)) dto: any) {
    return this.users.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(userUpdateSchema)) dto: any) {
    return this.users.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }

  // Permanent, irreversible delete (distinct from the soft deactivate above).
  @Delete(":id/hard")
  hardRemove(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    return this.users.hardRemove(id, user.id);
  }

  @Post(":id/reset-password")
  reset(@Param("id") id: string, @Body(new ZodValidationPipe(resetPasswordSchema)) dto: any) {
    return this.users.resetPassword(id, dto.password);
  }
}
