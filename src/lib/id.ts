import { randomUUID } from "crypto";

export function id(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
