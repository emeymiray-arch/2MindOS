import type { Goal, LifeLayer, LifeStore, Sphere } from "./types";

export type Side = LifeLayer; // "inner" | "outer"

export const SIDE_LABEL: Record<Side, string> = {
  inner: "Внутреннее",
  outer: "Внешнее",
};

export const SIDE_HINT: Record<Side, string> = {
  inner: "Принципы, понятия, дисциплина, то, что формируешь в себе",
  outer: "Стиль, навыки, подача, то, как тебя читают снаружи",
};

/** Prefer explicit goal.layer, then direction bias, else unset. */
export function resolveGoalSide(
  goal: Pick<Goal, "layer" | "lifeAreaId">,
  spheres: Pick<Sphere, "id" | "layerBias">[]
): Side | null {
  if (goal.layer === "inner" || goal.layer === "outer") return goal.layer;
  const area = spheres.find((s) => s.id === goal.lifeAreaId);
  if (area?.layerBias === "inner" || area?.layerBias === "outer") return area.layerBias;
  return null;
}

export function resolveGoalSideFromStore(store: LifeStore, goal: Goal): Side | null {
  return resolveGoalSide(goal, store.spheres ?? []);
}

export function partitionBySide<T extends { side: Side | null }>(items: T[]) {
  return {
    inner: items.filter((i) => i.side === "inner"),
    outer: items.filter((i) => i.side === "outer"),
    unset: items.filter((i) => i.side == null),
  };
}
