import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { analysisToCsv } from "@/lib/soda/analysis";
import { persistAnalysis } from "@/lib/soda/complete";
import { analysisToXlsx } from "@/lib/soda/spreadsheet";
import { getInstance } from "@/lib/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const instance = await getInstance(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!instance.causeMap) {
    return NextResponse.json({ error: "Weave a cause map first." }, { status: 400 });
  }
  let analysis = instance.analysis;
  if (!analysis) {
    analysis = await persistAnalysis(id, instance.causeMap);
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv") {
    const csv = analysisToCsv(analysis);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="soda-${id}-priorities.csv"`,
      },
    });
  }
  const xlsx = await analysisToXlsx(analysis);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="soda-${id}-priorities.xlsx"`,
    },
  });
}
