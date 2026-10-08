import { z } from "zod";
import { dateKey, nonEmpty, nonNegAmount, optionalId, positiveAmount } from "./common";

export const financeKind = z.enum(["income", "expense", "mandatory", "savings"]);

export const financeSchemas = {
  add: z.object({
    action: z.literal("add").optional(),
    title: nonEmpty,
    amount: positiveAmount,
    categoryId: optionalId,
    type: financeKind.optional(),
    date: dateKey.optional(),
    note: z.string().optional(),
    wishItemId: optionalId,
    wishBlockId: optionalId,
  }),
  addCategory: z.object({
    action: z.literal("addCategory"),
    name: nonEmpty,
    kind: financeKind.default("expense"),
    color: z.string().trim().min(1).default("#a855f7"),
  }),
  updateCategory: z.object({
    action: z.literal("updateCategory"),
    id: nonEmpty,
    name: z.string().trim().min(1).optional(),
    kind: financeKind.optional(),
    color: z.string().trim().min(1).optional(),
    archived: z.boolean().optional(),
  }),
  deleteCategory: z.object({
    action: z.literal("deleteCategory"),
    id: nonEmpty,
  }),
  setCushion: z.object({
    action: z.literal("setCushion"),
    cushion: nonNegAmount,
  }),
  clearCushionManual: z.object({
    action: z.literal("clearCushionManual"),
  }),
  setSalary: z.object({
    action: z.literal("setSalary"),
    salary: nonNegAmount,
  }),
  paySalary: z.object({
    action: z.literal("paySalary"),
    amount: positiveAmount.optional(),
    title: z.string().optional(),
    date: dateKey.optional(),
    force: z.boolean().optional(),
  }),
  update: z.object({
    action: z.literal("update"),
    id: nonEmpty,
    title: z.string().optional(),
    amount: z.coerce.number().finite().optional(),
    categoryId: optionalId,
    type: financeKind.optional(),
    date: dateKey.optional(),
    note: z.string().nullable().optional(),
    wishItemId: optionalId,
    wishBlockId: optionalId,
  }),
  delete: z.object({
    action: z.literal("delete"),
    id: nonEmpty,
  }),
} as const;

export type FinanceAction = keyof typeof financeSchemas;
