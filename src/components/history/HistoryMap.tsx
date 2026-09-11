"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ALL_TIMELINE_KINDS,
  TIMELINE_KIND_LABELS,
  eventsByKind,
  formatTimelineTime,
  summarizeTimeline,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/timeline";
import { UI, type UiTone } from "@/lib/ui-colors";
import { formatMinutes } from "@/lib/time";

const CANVAS = 2400;
const HUB = { w: 400, h: 440 };
const BRANCH = { w: 272, rowH: 26, headH: 52, maxRows: 8 };
const RADIUS = 500;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.2;

type Transform = { x: number; y: number; scale: number };

function kindTone(kind: TimelineKind): UiTone {
  const map: Record<TimelineKind, UiTone> = {
    task: "tasks",
    habit: "goals",
    time: "focus",
    finance: "neutral",
    thought: "neutral",
    capture: "neutral",
    quest: "focus",
    vitals: "goals",
    project: "mandatory",
    calendar: "tasks",
    thing: "savings",
  };
  return map[kind];
}

function touchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function branchHeight(rows: number) {
  return BRANCH.headH + Math.max(rows, 1) * BRANCH.rowH + 12;
}

function useZoomPan(viewportRef: React.RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 0.55 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const scaleRef = useRef(transform.scale);
  const transformRef = useRef(transform);
  scaleRef.current = transform.scale;
  transformRef.current = transform;

  const fitView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const scale = clampScale(Math.min(el.clientWidth / CANVAS, el.clientHeight / CANVAS) * 0.92);
    setTransform({
      x: (el.clientWidth - CANVAS * scale) / 2,
      y: (el.clientHeight - CANVAS * scale) / 2,
      scale,
    });
  }, [viewportRef]);

  useEffect(() => {
    fitView();
    window.addEventListener("resize", fitView);
    return () => window.removeEventListener("resize", fitView);
  }, [fitView]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;

      setTransform((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: mx - (mx - prev.x) * ratio,
          y: my - (my - prev.y) * ratio,
        };
      });
    },
    [viewportRef]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, onWheel]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("a, button, input, [role=button]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t = transformRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setTransform((prev) => ({
      ...prev,
      x: drag.tx + dx,
      y: drag.ty + dy,
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: touchDistance(e.touches), scale: scaleRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = touchDistance(e.touches);
      const nextScale = clampScale(pinchRef.current.scale * (dist / pinchRef.current.dist));
      setTransform((prev) => ({ ...prev, scale: nextScale }));
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [viewportRef]);

  const zoomBy = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setTransform((prev) => {
      const nextScale = clampScale(prev.scale * factor);
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  };

  return { transform, fitView, zoomBy, onPointerDown, onPointerMove, onPointerUp };
}

function SummaryHub({
  cx,
  cy,
  from,
  to,
  summary,
}: {
  cx: number;
  cy: number;
  from: string;
  to: string;
  summary: ReturnType<typeof summarizeTimeline>;
}) {
  const left = cx - HUB.w / 2;
  const top = cy - HUB.h / 2;
  const period =
    from && to
      ? `${from.split("-").reverse().join(".")} — ${to.split("-").reverse().join(".")}`
      : "—";

  const visibleKinds = ALL_TIMELINE_KINDS.filter((k) => (summary.counts[k] ?? 0) > 0);

  return (
    <div className="history-hub" style={{ left, top, width: HUB.w, height: HUB.h }}>
      <p className="history-hub-title">Сводка</p>
      <p className="meta-text">{period}</p>
      <div className="history-hub-stats">
        <div>
          <span className="history-hub-num">{summary.total}</span>
          <span className="meta-text">событий</span>
        </div>
        <div>
          <span className="history-hub-num">{summary.activeDays}</span>
          <span className="meta-text">дней</span>
        </div>
        <div>
          <span className="history-hub-num">{formatMinutes(summary.focusMinutes)}</span>
          <span className="meta-text">фокус</span>
        </div>
      </div>
      <table className="history-table history-table-hub">
        <thead>
          <tr>
            <th>Категория</th>
            <th>Кол-во</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {visibleKinds.length === 0 ? (
            <tr>
              <td colSpan={3} className="meta-text">
                нет данных за период
              </td>
            </tr>
          ) : (
            visibleKinds.map((kind) => {
              const n = summary.counts[kind] ?? 0;
              const pct = summary.total ? Math.round((n / summary.total) * 100) : 0;
              const c = UI[kindTone(kind)];
              return (
                <tr key={kind}>
                  <td>
                    <span className="history-kind-dot" style={{ background: c.fg }} />
                    {TIMELINE_KIND_LABELS[kind]}
                  </td>
                  <td className="tabular-nums">{n}</td>
                  <td className="tabular-nums">{pct}%</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {(summary.income > 0 || summary.expense > 0) && (
        <p className="meta-text mt-2">
          {summary.income > 0 ? `+${summary.income.toLocaleString("ru-RU")} ₽` : null}
          {summary.income > 0 && summary.expense > 0 ? " · " : null}
          {summary.expense > 0 ? `−${summary.expense.toLocaleString("ru-RU")} ₽` : null}
        </p>
      )}
    </div>
  );
}

function BranchCard({
  kind,
  events,
  cx,
  cy,
  active,
  onSelect,
}: {
  kind: TimelineKind;
  events: TimelineEvent[];
  cx: number;
  cy: number;
  active: boolean;
  onSelect: () => void;
}) {
  const tone = kindTone(kind);
  const c = UI[tone];
  const rows = events.slice(0, BRANCH.maxRows);
  const h = branchHeight(rows.length || 1);
  const left = cx - BRANCH.w / 2;
  const top = cy - h / 2;

  return (
    <div
      className={`history-branch ${active ? "history-branch-on" : ""}`}
      style={{
        left,
        top,
        width: BRANCH.w,
        borderColor: active ? c.border : undefined,
        background: active ? c.bg : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      role="button"
      tabIndex={0}
    >
      <div className="history-branch-head" style={{ color: c.fg }}>
        <span>{TIMELINE_KIND_LABELS[kind]}</span>
        <span className="tabular-nums">{events.length}</span>
      </div>
      <table className="history-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Событие</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="meta-text">
                нет записей
              </td>
            </tr>
          ) : (
            rows.map((ev) => {
              const time = formatTimelineTime(ev.at);
              const dateLabel = time
                ? `${formatShortDate(ev.date)} ${time}`
                : formatShortDate(ev.date);
              return (
                <tr key={ev.id}>
                  <td className="tabular-nums">{dateLabel}</td>
                  <td>
                    {ev.href ? (
                      <Link href={ev.href} className="history-branch-link" onClick={(e) => e.stopPropagation()}>
                        <span className="history-branch-title">{ev.title}</span>
                      </Link>
                    ) : (
                      <span className="history-branch-title">{ev.title}</span>
                    )}
                    {ev.subtitle ? (
                      <span className="history-branch-sub">{ev.subtitle}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {events.length > BRANCH.maxRows ? (
        <p className="meta-text history-branch-more">+{events.length - BRANCH.maxRows} ещё</p>
      ) : null}
    </div>
  );
}

export function HistoryMap({
  events,
  from,
  to,
}: {
  events: TimelineEvent[];
  from: string;
  to: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { transform, fitView, zoomBy, onPointerDown, onPointerMove, onPointerUp } =
    useZoomPan(viewportRef);
  const [activeKind, setActiveKind] = useState<TimelineKind | null>(null);

  const summary = useMemo(() => summarizeTimeline(events), [events]);
  const byKind = useMemo(() => eventsByKind(events), [events]);
  const hubCx = CANVAS / 2;
  const hubCy = CANVAS / 2;

  const branches = useMemo(() => {
    return ALL_TIMELINE_KINDS.map((kind, i) => {
      const angle = (i / ALL_TIMELINE_KINDS.length) * Math.PI * 2 - Math.PI / 2;
      return {
        kind,
        cx: hubCx + Math.cos(angle) * RADIUS,
        cy: hubCy + Math.sin(angle) * RADIUS,
        events: byKind[kind],
      };
    });
  }, [byKind, hubCx, hubCy]);

  return (
    <div className="history-map-wrap">
      <div className="history-map-controls">
        <button type="button" className="history-zoom-btn" onClick={() => zoomBy(1.15)} aria-label="Увеличить">
          +
        </button>
        <button type="button" className="history-zoom-btn" onClick={() => zoomBy(1 / 1.15)} aria-label="Уменьшить">
          −
        </button>
        <button type="button" className="history-zoom-btn history-zoom-reset" onClick={fitView}>
          Центр
        </button>
        <span className="meta-text hidden sm:inline">Pinch или колёсико · перетащи карту</span>
      </div>

      <div
        ref={viewportRef}
        className="history-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="history-canvas"
          style={{
            width: CANVAS,
            height: CANVAS,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <svg className="history-lines" width={CANVAS} height={CANVAS} aria-hidden>
            {branches.map((b) => {
              const active = activeKind === b.kind;
              const c = UI[kindTone(b.kind)];
              return (
                <line
                  key={b.kind}
                  x1={hubCx}
                  y1={hubCy}
                  x2={b.cx}
                  y2={b.cy}
                  className={`history-branch-line ${active ? "history-branch-line-on" : ""}`}
                  style={{ stroke: active ? c.fg : undefined }}
                />
              );
            })}
          </svg>

          <SummaryHub cx={hubCx} cy={hubCy} from={from} to={to} summary={summary} />

          {branches.map((b) => (
            <BranchCard
              key={b.kind}
              kind={b.kind}
              events={b.events}
              cx={b.cx}
              cy={b.cy}
              active={activeKind === b.kind}
              onSelect={() => setActiveKind((k) => (k === b.kind ? null : b.kind))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
