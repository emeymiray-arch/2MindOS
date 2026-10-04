import { apiError } from "@/lib/api-response";
import { buildExportWorkbook } from "@/lib/export-xlsx";
import { todayKey } from "@/lib/id";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const today = todayKey();
    const store = await getStore();
    const wb = await buildExportWorkbook(store, today);
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `2MindOS-svodka-${today}.xlsx`;
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e, "export");
  }
}
