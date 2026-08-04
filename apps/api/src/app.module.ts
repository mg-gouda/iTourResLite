import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { HotelsModule } from "./modules/hotels/hotels.module";
import { ParamsModule } from "./modules/params/params.module";
import { StopSalesModule } from "./modules/stop-sales/stop-sales.module";
import { MaterializationModule } from "./modules/materialization/materialization.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { UsersModule } from "./modules/users/users.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { LicenseModule } from "./modules/license/license.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { FxModule } from "./modules/fx/fx.module";
import { HealthController } from "./modules/health/health.controller";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    BookingsModule,
    HotelsModule,
    ParamsModule,
    StopSalesModule,
    MaterializationModule,
    DashboardModule,
    UsersModule,
    ReportsModule,
    ProfileModule,
    LicenseModule,
    PermissionsModule,
    FxModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1) authenticate (cookie/JWT)
    { provide: APP_GUARD, useClass: RolesGuard }, // 2) authorize (@Roles)
  ],
})
export class AppModule {}
