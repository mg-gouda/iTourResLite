"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { exportToPdf, exportToExcel, type ExportSpec } from "@/lib/export";

/**
 * PDF + Excel export buttons for a report/table page. `build` is called at
 * click time so the current rows/filters are captured. Both formats embed the
 * company logo from Company Settings.
 */
export function ExportButtons({
  build,
  disabled,
}: {
  build: () => ExportSpec;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<null | "pdf" | "excel">(null);

  async function run(kind: "pdf" | "excel") {
    if (busy) return;
    setBusy(kind);
    try {
      const spec = build();
      if (kind === "pdf") await exportToPdf(spec);
      else await exportToExcel(spec);
    } catch (err) {
      console.error("Export failed", err);
      alert("Export failed — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => run("pdf")} disabled={disabled || busy !== null}>
        {busy === "pdf" ? <Spinner className="size-4" /> : <FileText className="size-4" />} PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => run("excel")} disabled={disabled || busy !== null}>
        {busy === "excel" ? <Spinner className="size-4" /> : <FileSpreadsheet className="size-4" />} Excel
      </Button>
    </>
  );
}
