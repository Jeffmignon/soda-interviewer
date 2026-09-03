import ExcelJS from "exceljs";
import type { AnalysisRecord } from "@/lib/types";

export async function analysisToXlsx(analysis: AnalysisRecord): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SODA interviewer";
  const sheet = wb.addWorksheet("Priorities", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "priority", key: "priority", width: 10 },
    { header: "statement", key: "statement", width: 48 },
    { header: "type", key: "type", width: 18 },
    { header: "why", key: "why", width: 56 },
    { header: "authors", key: "authors", width: 24 },
    { header: "notes", key: "notes", width: 40 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A1714" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFF3EEE4" } };

  for (const row of analysis.rows) {
    sheet.addRow(row);
  }

  const notes = wb.addWorksheet("Method");
  notes.addRow(["mode", analysis.mode]);
  notes.addRow(["note", analysis.note]);
  notes.addRow(["goal system", analysis.goalSystem]);
  notes.addRow(["domain", analysis.domain]);
  notes.addRow(["central", analysis.central]);
  notes.addRow(["clusters", analysis.clusters]);
  notes.addRow(["teardrops", analysis.teardrops]);
  notes.getColumn(1).width = 16;
  notes.getColumn(2).width = 100;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
