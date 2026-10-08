import { z } from "zod";

export const nonEmpty = z.string().trim().min(1, "Обязательное поле");

/** Optional id: missing / empty → undefined. */
export const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().min(1).optional()
);

export const dateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Некорректная дата")
  .transform((s) => s.slice(0, 10));

export const positiveAmount = z.coerce.number().finite().gt(0, "Сумма должна быть больше 0");

export const nonNegAmount = z.coerce
  .number()
  .finite()
  .min(0, "Значение не может быть отрицательным");
