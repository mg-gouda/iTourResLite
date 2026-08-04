import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { FxService } from "./fx.service";

@Controller("fx")
export class FxController {
  constructor(private fx: FxService) {}

  /** USD → EUR reference rate used by the report currency-conversion cards. */
  @Get("usd-eur")
  async usdEur() {
    try {
      return await this.fx.getUsdEur();
    } catch {
      throw new ServiceUnavailableException("Exchange rate is temporarily unavailable");
    }
  }
}
