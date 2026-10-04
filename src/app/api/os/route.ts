import { apiError, apiJson } from "@/lib/api-response";
import { displayCurrency } from "@/lib/format";
import { ensureTodayComposed, pickNextPurchase, shouldAutoCompose } from "@/lib/compose-today";
import {
  activeDirections,
  buildAttentionSignals,
  ensurePeriodFocus,
  monthKeyFromDate,
} from "@/lib/directions";
import { todayKey } from "@/lib/id";
import {
  activePlan,
  calcWorkPlanProgress,
  currentWorkPhase,
  findWorkPlan,
  inheritTaskPriority,
  phaseModules,
  phasesOf,
} from "@/lib/lifeos";
import {
  monthExpected,
  planRealityForGoal,
  taskProvenance,
  timelineForPlan,
  weekPulse,
  buildAnalytics,
} from "@/lib/plan-reality";
import { getStore, updateStore } from "@/lib/store";
import { calcGoalProgress, tasksForDate } from "@/lib/tasks";
import {
  groupStagesIntoPhases,
  effectiveHorizonStage,
  horizonStageLabel,
  horizonStageShort,
  stageWindow,
  horizonAnchor,
  currentHorizonStage,
  currentDiaryPhase,
  diaryStagesForPhase,
  bucketForHorizonStage,
} from "@/lib/plan-calendar";

/** Full-cycle snapshot for Home + Goal picture. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = todayKey();
    const goalId = url.searchParams.get("goalId");
    const wantCompose = url.searchParams.get("compose") !== "0";

    // Home only: compose today when needed (dry-run skips cloud/local write).
    // Goal detail is read-only — no normalize/unlock write on every open.
    if (!goalId && wantCompose && shouldAutoCompose(today)) {
      await ensureTodayComposed(getStore, updateStore, today);
    }

    if (goalId) {
      const fresh = await getStore();
      const g = fresh.goals.find((x) => x.id === goalId);
      if (!g) return apiJson({ error: "not found" }, { status: 404 });
      const plan = g.workPlanId ? findWorkPlan(fresh, g.workPlanId) : undefined;
      const reality = planRealityForGoal(fresh, g, today);
      const phase = plan ? currentWorkPhase(plan) : null;
      const phaseGroups = plan
        ? groupStagesIntoPhases(plan).map((grp) => ({
            phaseNum: grp.phaseNum,
            label: grp.label,
            start: grp.start,
            end: grp.end,
            progress: grp.progress,
            stages: grp.stages.map((ph) => ({
              id: ph.id,
              title: ph.title,
              progress: ph.progress ?? 0,
              status: ph.status,
              deadlineStart: ph.deadlineStart,
              deadlineEnd: ph.deadlineEnd,
              durationWeeks: ph.durationWeeks,
              modules: phaseModules(ph),
            })),
          }))
        : [];
      return apiJson({
        goal: {
          ...g,
          progress: plan ? calcWorkPlanProgress(plan) : calcGoalProgress(g, fresh),
          area: fresh.spheres.find((s) => s.id === g.lifeAreaId) ?? null,
          horizonStage: effectiveHorizonStage(g),
          horizonStageLabel: horizonStageLabel(effectiveHorizonStage(g)),
          horizonStageShort: horizonStageShort(effectiveHorizonStage(g)),
          horizonWindow: stageWindow(horizonAnchor(fresh), effectiveHorizonStage(g)),
        },
        reality,
        week: weekPulse(fresh, today, g.id),
        month: {
          key: today.slice(0, 7),
          items: monthExpected(plan, today),
        },
        timeline: plan ? timelineForPlan(plan) : [],
        plan: plan
          ? {
              id: plan.id,
              title: plan.title,
              progress: calcWorkPlanProgress(plan),
              deadline: plan.deadline,
              desiredResult: plan.desiredResult,
              phases: phasesOf(plan).map((ph) => ({
                id: ph.id,
                title: ph.title,
                progress: ph.progress ?? 0,
                status: ph.status,
                deadlineStart: ph.deadlineStart,
                deadlineEnd: ph.deadlineEnd,
                durationWeeks: ph.durationWeeks,
                modules: phaseModules(ph),
              })),
              phaseGroups,
            }
          : null,
        phase: phase ? { id: phase.id, title: phase.title } : null,
        todayTasks: tasksForDate(fresh, today)
          .filter((t) => t.goalId === g.id || t.workPlanId === g.workPlanId)
          .map((t) => ({
            ...t,
            provenance: taskProvenance(fresh, t),
            effectivePriority: inheritTaskPriority(fresh, t),
          })),
      });
    }

    let store = await getStore();
    const monthKeyNeeded = monthKeyFromDate(today);
    if (!store.periodFocus?.some((p) => p.monthKey === monthKeyNeeded)) {
      store = await updateStore((s) => {
        ensurePeriodFocus(s, monthKeyNeeded);
      });
    }

    // Home Today: habits + personal tasks + next purchase — not goal stages
    const dayTasks = tasksForDate(store, today).map((t) => {
      const provenance = taskProvenance(store, t);
      return {
        ...t,
        provenance,
        effectivePriority: inheritTaskPriority(store, t),
      };
    });

    const habits = dayTasks.filter((t) => t.provenance.source === "habit" || t.habitId);
    const phaseNum = currentDiaryPhase(store, today);
    const diaryStages = diaryStagesForPhase(store, phaseNum, today);
    const stageOrders = new Set(diaryStages.map((s) => s.order));

    const fromGoals = dayTasks
      .filter((t) => {
        if (t.habitId) return false;
        if (!t.goalId) return false;
        if (!(t.autoSource?.includes(":topic:") || t.autoSource?.includes(":stage:"))) return false;
        const g = store.goals.find((x) => x.id === t.goalId);
        if (!g || !g.active || g.archived) return false;
        return stageOrders.has(effectiveHorizonStage(g));
      })
      .map((t) => {
        const g = store.goals.find((x) => x.id === t.goalId)!;
        return {
          ...t,
          horizonStage: effectiveHorizonStage(g),
          goalTitle: g.title,
        };
      });

    // Hide known junk leftovers from early testing
    const junk = new Set(["продажи", "test task", "тест таск"]);
    const personal = dayTasks.filter(
      (t) =>
        !t.habitId &&
        !t.projectId &&
        t.provenance.source !== "habit" &&
        !t.autoSource &&
        !t.goalId &&
        !junk.has(t.title.trim().toLowerCase())
    );
    const overdue = (store.dayTasks ?? []).filter(
      (t) =>
        !t.archived &&
        !t.done &&
        t.date < today &&
        !t.habitId &&
        !t.projectId &&
        !t.autoSource &&
        !junk.has((t.title || "").trim().toLowerCase())
    );

    const activeGoals = store.goals.filter((g) => g.active && !g.archived);
    const monthKey = monthKeyFromDate(today);
    const focusRow = store.periodFocus.find((p) => p.monthKey === monthKey);
    const plan = activePlan(store);
    const curStage = currentHorizonStage(store, today);

    const goalRealities = activeGoals.map((g) => ({
      g,
      reality: planRealityForGoal(store, g, today),
    }));
    const behindTitles = goalRealities
      .filter((x) => x.reality.status === "behind")
      .map((x) => x.g.title);

    const mainDirIds = Object.entries(focusRow?.levels ?? {})
      .filter(([, lv]) => lv === "main")
      .map(([id]) => id);
    const todayDirIds = new Set(
      [...fromGoals, ...habits]
        .filter((t) => !t.done)
        .map((t) => t.lifeAreaId)
        .filter(Boolean) as string[]
    );
    const neglectedMain = activeDirections(store)
      .filter((d) => mainDirIds.includes(d.id) && !todayDirIds.has(d.id))
      .map((d) => d.name);

    const todayOpen =
      fromGoals.filter((t) => !t.done).length +
      personal.filter((t) => !t.done).length +
      habits.filter((t) => !t.done).length;

    const attention = buildAttentionSignals(store, {
      behindGoalTitles: behindTitles,
      todayTaskCount: todayOpen,
      capacity: store.settings.dailyCapacity ?? 6,
      neglectedMainNames: neglectedMain,
    });

    const directions = activeDirections(store).map((d) => ({
      id: d.id,
      name: d.name,
      focus: focusRow?.levels[d.id] ?? "background",
      layerBias: d.layerBias ?? "both",
      goals: activeGoals.filter((g) => g.lifeAreaId === d.id).length,
    }));

    return apiJson({
      today,
      week: weekPulse(store, today),
      analytics: buildAnalytics(store, today),
      nextPurchase: pickNextPurchase(store),
      life: {
        vision:
          store.settings.visionNote?.trim() ||
          store.settings.yearProgressNote?.trim() ||
          "",
        planTitle: plan?.title ?? null,
        planStart: plan?.startDate ?? null,
        planEnd: plan?.endDate ?? null,
        horizonStage: curStage,
        horizonStageLabel: horizonStageLabel(curStage),
        monthKey,
        directions,
        attention,
        pendingInbox: (store.captures ?? []).filter((c) => c.status === "pending").length,
        principlesCount: (store.principles ?? []).filter((p) => !p.archived).length,
        recentOutcomes: (store.outcomes ?? [])
          .filter((o) => !o.archived)
          .slice(-3)
          .reverse(),
      },
      diary: {
        phaseNum,
        label: `Фаза ${phaseNum}`,
        stages: diaryStages,
        defaultStage: diaryStages.find((s) => s.current)?.order ?? diaryStages[0]?.order ?? 1,
      },
      tasks: {
        fromGoals,
        personal,
        habits,
        overdue: overdue.slice(0, 20).map((t) => ({
          ...t,
          provenance: taskProvenance(store, t),
        })),
      },
      goals: activeGoals.map((g) => {
        const wp = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
        const reality = planRealityForGoal(store, g, today);
        const stage = effectiveHorizonStage(g);
        return {
          id: g.id,
          title: g.title,
          deadline: g.deadline,
          priority: g.priority ?? "medium",
          bucket: bucketForHorizonStage(stage, currentHorizonStage(store, today)),
          horizonStage: stage,
          area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
          lifeAreaId: g.lifeAreaId,
          layer: g.layer,
          hasPlan: Boolean(wp),
          phase: wp ? currentWorkPhase(wp)?.title : null,
          reality,
        };
      }),
      finance: store.finance
        ? {
            income: store.finance.incomeMonth,
            expenses: store.finance.expensesMonth,
            salary: store.finance.salary ?? 0,
            cushion: store.finance.cushion,
            currency: displayCurrency(store.finance.currency),
          }
        : null,
    });
  } catch (e) {
    return apiError(e);
  }
}
