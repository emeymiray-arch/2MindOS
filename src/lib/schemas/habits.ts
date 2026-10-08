import { z } from "zod";
import { nonEmpty, optionalId } from "./common";

export const habitSchemas = {
  create: z.object({
    action: z.literal("create").optional(),
    title: nonEmpty,
    targetPerDay: z.coerce.number().finite().positive().optional(),
    unit: z.string().optional(),
    frequency: z.enum(["daily", "weekly"]).optional(),
    goalId: optionalId,
    lifeAreaId: optionalId,
  }),
  log: z.object({
    action: z.literal("log"),
    habitId: nonEmpty,
    value: z.coerce.number().finite().min(0),
    date: z.string().optional(),
  }),
  delete: z.object({
    action: z.literal("delete"),
    id: nonEmpty,
  }),
  archive: z.object({
    action: z.literal("archive"),
    id: nonEmpty,
  }),
  update: z.object({
    action: z.literal("update"),
    id: nonEmpty,
    title: z.string().trim().min(1).optional(),
    targetPerDay: z.coerce.number().finite().positive().optional(),
    unit: z.string().optional(),
    frequency: z.enum(["daily", "weekly"]).optional(),
    goalId: optionalId,
    lifeAreaId: optionalId,
    active: z.boolean().optional(),
  }),
} as const;
