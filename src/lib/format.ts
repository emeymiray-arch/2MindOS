/** Human deadline: "до 1 марта 2026" */
export function formatDeadline(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const text = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `до ${text}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function normalizeHashtag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}
