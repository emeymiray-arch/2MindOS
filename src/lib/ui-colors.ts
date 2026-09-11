/** Semantic UI colors — paper studio palette. */
export const UI = {
  income: { fg: "#3d7a52", bg: "rgba(61, 122, 82, 0.1)", border: "rgba(61, 122, 82, 0.28)" },
  expense: { fg: "#b54432", bg: "rgba(181, 68, 50, 0.1)", border: "rgba(181, 68, 50, 0.28)" },
  mandatory: { fg: "#c45c26", bg: "rgba(196, 92, 38, 0.1)", border: "rgba(196, 92, 38, 0.28)" },
  savings: { fg: "#3d6a8a", bg: "rgba(61, 106, 138, 0.1)", border: "rgba(61, 106, 138, 0.28)" },
  focus: { fg: "#c45c26", bg: "rgba(196, 92, 38, 0.1)", border: "rgba(196, 92, 38, 0.28)" },
  tasks: { fg: "#3d6a8a", bg: "rgba(61, 106, 138, 0.1)", border: "rgba(61, 106, 138, 0.28)" },
  overload: { fg: "#b54432", bg: "rgba(181, 68, 50, 0.08)", border: "rgba(181, 68, 50, 0.25)" },
  goals: { fg: "#3d7a52", bg: "rgba(61, 122, 82, 0.1)", border: "rgba(61, 122, 82, 0.28)" },
  neutral: { fg: "#5c5348", bg: "rgba(92, 83, 72, 0.08)", border: "rgba(92, 83, 72, 0.18)" },
} as const;

export type UiTone = keyof typeof UI;

export function financeTone(txType: string): UiTone {
  if (txType === "income") return "income";
  if (txType === "expense") return "expense";
  if (txType === "mandatory") return "mandatory";
  if (txType === "savings") return "savings";
  return "neutral";
}

export function financeTypeLabel(txType: string): string {
  const map: Record<string, string> = {
    income: "Доход",
    expense: "Расход",
    mandatory: "Обязательное",
    savings: "Копилка",
  };
  return map[txType] ?? txType;
}
