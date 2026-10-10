export type AccentColor = "blue" | "green" | "purple" | "red" | "yellow";

export const ACCENT_COLORS: AccentColor[] = [
  "blue",
  "green",
  "purple",
  "red",
  "yellow",
];

export const ACCENT_LABELS: Record<AccentColor, string> = {
  blue: "Синий",
  green: "Зелёный",
  purple: "Фиолетовый",
  red: "Красный",
  yellow: "Жёлтый",
};

export const ACCENT_HEX: Record<AccentColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  red: "#ef4444",
  yellow: "#eab308",
};

export function isAccentColor(v: unknown): v is AccentColor {
  return typeof v === "string" && (ACCENT_COLORS as string[]).includes(v);
}

export function persistAccent(accent: AccentColor) {
  try {
    localStorage.setItem("mindos-accent", accent);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-accent", accent);
}
