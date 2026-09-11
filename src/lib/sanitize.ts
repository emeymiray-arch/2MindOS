import type { LifeStore, PasswordEntry } from "./types";

export function maskPassword(p: PasswordEntry): PasswordEntry {
  return { ...p, secret: p.secret ? "••••••••••••" : "" };
}

/** Safe for UI, browser backup, and client export — no raw secrets. */
export function publicStore(store: LifeStore): LifeStore {
  const settings = { ...store.settings };
  if (settings.shortcutsToken) {
    settings.shortcutsToken = "••••••••";
  }
  return {
    ...store,
    settings,
    passwords: (store.passwords ?? []).map(maskPassword),
  };
}
