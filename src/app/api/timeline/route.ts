import { apiError, apiJson } from "@/lib/api-response";
import { getStore } from "@/lib/store";
import {
  ALL_TIMELINE_KINDS,
  buildTimeline,
  countByKind,
  timelineRangeBounds,
  type TimelineKind,
  type TimelineRange,
} from "@/lib/timeline";

const RANGES: TimelineRange[] = ["day", "week", "month", "half", "year"];

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rangeParam = params.get("range") as TimelineRange | null;
    const range: TimelineRange =
      rangeParam && RANGES.includes(rangeParam) ? rangeParam : "month";

    const before = params.get("before") ?? undefined;
    const fromParam = params.get("from");
    const toParam = params.get("to");

    const bounds =
      fromParam && toParam
        ? { from: fromParam, to: toParam }
        : timelineRangeBounds(range, undefined, before);

    const typesParam = params.get("types");
    const kinds: TimelineKind[] | undefined = typesParam
      ? (typesParam
          .split(",")
          .map((t) => t.trim())
          .filter((t): t is TimelineKind => ALL_TIMELINE_KINDS.includes(t as TimelineKind)) as TimelineKind[])
      : undefined;

    const limit = Math.min(Math.max(Number(params.get("limit") ?? 300), 1), 500);

    const store = await getStore();
    const all = buildTimeline(store, { ...bounds, kinds });
    const events = all.slice(0, limit);
    const counts = countByKind(all);

    const hasMore = all.length > limit || bounds.from > "2020-01-01";
    const nextBefore = bounds.from;

    return apiJson({
      range,
      from: bounds.from,
      to: bounds.to,
      events,
      total: all.length,
      totalInWindow: all.length,
      counts,
      hasMore,
      nextBefore,
    });
  } catch (e) {
    return apiError(e, "timeline");
  }
}
