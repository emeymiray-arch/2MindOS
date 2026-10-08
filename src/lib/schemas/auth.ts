import { z } from "zod";

export const authSchemas = {
  logout: z.object({
    action: z.literal("logout"),
  }),
  adminLogin: z
    .object({
      action: z.literal("adminLogin"),
      secret: z.string().optional(),
      adminSecret: z.string().optional(),
    })
    .refine((v) => Boolean((v.secret ?? v.adminSecret ?? "").trim()), {
      message: "Нужен админ-ключ",
      path: ["secret"],
    }),
  login: z.object({
    action: z.literal("login").optional(),
    login: z.string().trim().optional(),
    password: z.string().optional(),
    secret: z.string().optional(),
  }),
} as const;
