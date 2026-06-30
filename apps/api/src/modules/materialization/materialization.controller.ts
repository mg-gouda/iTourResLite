import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { materializationQuerySchema } from "@itour/shared";
import { MaterializationService } from "./materialization.service";
import { renderGridHtml } from "./materialization.html";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("materialization")
export class MaterializationController {
  constructor(private mat: MaterializationService) {}

  @Get()
  grid(@Query(new ZodValidationPipe(materializationQuerySchema)) q: any) {
    return this.mat.grid(q.hotelId, q.from, q.to);
  }

  // PDF export (§5.2). Uses Puppeteer when available; otherwise returns print-ready HTML.
  @Get("pdf")
  async pdf(
    @Query(new ZodValidationPipe(materializationQuerySchema)) q: any,
    @Res() res: Response,
  ) {
    const grid = await this.mat.grid(q.hotelId, q.from, q.to);
    const html = renderGridHtml(grid);
    const filename = `materialization-${grid.hotelName.replace(/[^a-z0-9]+/gi, "_")}-${grid.from}_${grid.to}`;

    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({ args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buffer = await page.pdf({ format: "A3", landscape: true, printBackground: true });
      await browser.close();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      res.end(buffer);
    } catch {
      // Fallback: print-ready HTML (the browser can "Save as PDF").
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${filename}.html"`);
      res.send(html);
    }
  }
}
