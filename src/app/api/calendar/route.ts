import { apiError, apiJson } from "@/lib/api-response";
import {
  buildDayCalendar,
  buildMonthCalendar,
  buildYearCalendar,
} from "@/lib/calendar-summary";
import { todayKey } from "@/lib/id";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = todayKey();
    const date = url.searchParams.get("date");
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const store = await getStore();

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return apiJson({ error: "bad date" }, { status: 400 });
      }
      return apiJson({
        view: "day",
        today,
        day: buildDayCalendar(store, date),
      });
    }

    const year = yearParam ? Number(yearParam) : Number(today.slice(0, 4));
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return apiJson({ error: "bad year" }, { status: 400 });
    }

    if (monthParam) {
      const month = Number(monthParam);
      if (!Number.isFinite(month) || month < 1 || month > 12) {
        return apiJson({ error: "bad month" }, { status: 400 });
      }
      return apiJson({
        view: "month",
        today,
        month: buildMonthCalendar(store, year, month),
      });
    }

    return apiJson({
      view: "year",
      today,
      year: buildYearCalendar(store, year),
    });
  } catch (e) {
    return apiError(e);
  }
}
