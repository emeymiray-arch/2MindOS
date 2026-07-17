import type { LifeStore, PasswordEntry } from "./types";

export function maskPassword(p: PasswordEntry): PasswordEntry {
  return { ...p, secret: p.secret ? "••••••••••••" : "" };
}

/** Safe for UI/state dumps — never leak real secrets. */
export function publicStore(store: LifeStore): LifeStore {
  return {
    ...store,
    passwords: (store.passwords ?? []).map(maskPassword),
  };
}
