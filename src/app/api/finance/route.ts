import { displayCurrency } from "@/lib/format";
import { id, todayKey } from "@/lib/id";
import {
  ensureCategories,
  ensureFinance,
  recompute,
  resolveType,
  syncWishSavedToward,
} from "@/lib/finance-core";
import { parseValue, readJson, validationErrorResponse } from "@/lib/api-validate";
import { apiError, apiJson } from "@/lib/api-response";
import { financeSchemas } from "@/lib/schemas/finance";
import { getStore, updateStore } from "@/lib/store";
import type { FinanceTx, LifeStore } from "@/lib/types";

function snapshot(store: LifeStore) {
  const finance = ensureFinance(store);
  recompute(finance);
  syncWishSavedToward(store);
  return {
    ...finance,
    currency: displayCurrency(finance.currency),
    categories: [...(finance.categories ?? [])],
    transactions: [...(finance.transactions ?? [])],
    subscriptions: [...(finance.subscriptions ?? [])],
    goals: [...(finance.goals ?? [])],
  };
}

export async function GET() {
  const store = await getStore();
  return apiJson({ finance: snapshot(store) });
}

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    const action = String((raw as { action?: string } | null)?.action ?? "add");

    if (action === "add") {
      const data = parseValue(raw, financeSchemas.add);
      const preview = ensureFinance(await getStore());
      const resolved = resolveType(preview, data);
      if (!resolved) return apiJson({ error: "Выбери категорию" }, { status: 400 });
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const again = resolveType(finance, data) ?? resolved;
        const tx: FinanceTx = {
          id: id(),
          type: again.type,
          categoryId: again.categoryId,
          title: data.title,
          amount: data.amount,
          date: (data.date ?? todayKey()).slice(0, 10),
          note: data.note || undefined,
          wishItemId: again.type === "savings" ? data.wishItemId : undefined,
          wishBlockId: again.type === "savings" ? data.wishBlockId : undefined,
        };
        finance.transactions.unshift(tx);
        recompute(finance);
        syncWishSavedToward(s);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "addCategory") {
      const data = parseValue(raw, financeSchemas.addCategory);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.categories = finance.categories ?? [];
        finance.categories.push({
          id: id(),
          name: data.name,
          kind: data.kind,
          color: data.color,
        });
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "updateCategory") {
      const data = parseValue(raw, financeSchemas.updateCategory);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const cat = (finance.categories ?? []).find((c) => c.id === data.id);
        if (!cat) return;
        if (data.name != null) cat.name = data.name.trim() || cat.name;
        if (data.kind != null) cat.kind = data.kind;
        if (data.color != null) cat.color = data.color;
        if (data.archived != null) cat.archived = data.archived;
        for (const tx of finance.transactions) {
          if (tx.categoryId === cat.id && !tx.archived) tx.type = cat.kind;
        }
        recompute(finance);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "deleteCategory") {
      const data = parseValue(raw, financeSchemas.deleteCategory);
      const preview = ensureFinance(await getStore());
      const active = (preview.categories ?? []).filter((c) => !c.archived);
      if (active.length <= 1) {
        return apiJson({ error: "Нужна хотя бы одна категория" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const cat = (finance.categories ?? []).find((c) => c.id === data.id);
        if (!cat) return;
        cat.archived = true;
        const fallback = (finance.categories ?? []).find((c) => !c.archived);
        for (const tx of finance.transactions) {
          if (tx.categoryId === data.id) {
            tx.categoryId = fallback?.id;
            if (fallback) tx.type = fallback.kind;
          }
        }
        recompute(finance);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "setCushion") {
      const data = parseValue(raw, financeSchemas.setCushion);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.cushion = data.cushion;
        finance.cushionManual = true;
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "clearCushionManual") {
      parseValue(raw, financeSchemas.clearCushionManual);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.cushionManual = false;
        recompute(finance);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "setSalary") {
      const data = parseValue(raw, financeSchemas.setSalary);
      const store = await updateStore((s) => {
        ensureFinance(s).salary = data.salary;
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "paySalary") {
      const data = parseValue(raw, financeSchemas.paySalary);
      const preview = ensureFinance(await getStore());
      const amount = Number(data.amount ?? preview.salary ?? 0);
      if (!(amount > 0)) {
        return apiJson({ error: "Сначала укажи сумму ЗП" }, { status: 400 });
      }
      const month = todayKey().slice(0, 7);
      const already = preview.transactions.some(
        (t) =>
          !t.archived &&
          t.type === "income" &&
          typeof t.date === "string" &&
          t.date.startsWith(month) &&
          /зарплат|зп/i.test(t.title)
      );
      if (already && !data.force) {
        return apiJson({ error: "ЗП за этот месяц уже есть в истории" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const incomeCat = ensureCategories(finance).find((c) => !c.archived && c.kind === "income");
        finance.transactions.unshift({
          id: id(),
          type: "income",
          categoryId: incomeCat?.id,
          title: String(data.title ?? "Зарплата").trim() || "Зарплата",
          amount,
          date: (data.date ?? todayKey()).slice(0, 10),
          note: "ЗП",
        });
        recompute(finance);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "update") {
      const data = parseValue(raw, financeSchemas.update);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const tx = finance.transactions.find((t) => t.id === data.id);
        if (!tx) return;
        if (data.title != null) tx.title = data.title.trim() || tx.title;
        if (data.amount != null) tx.amount = data.amount;
        if (data.categoryId != null || data.type != null) {
          const resolved = resolveType(finance, data);
          if (resolved) {
            tx.type = resolved.type;
            tx.categoryId = resolved.categoryId;
          }
        }
        if (data.date != null) tx.date = data.date;
        if (data.note !== undefined) tx.note = data.note || undefined;
        if (data.wishItemId !== undefined) tx.wishItemId = data.wishItemId;
        if (data.wishBlockId !== undefined) tx.wishBlockId = data.wishBlockId;
        recompute(finance);
        syncWishSavedToward(s);
      });
      return apiJson({ finance: snapshot(store) });
    }

    if (action === "delete") {
      const data = parseValue(raw, financeSchemas.delete);
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.transactions = finance.transactions.filter((t) => t.id !== data.id);
        recompute(finance);
        syncWishSavedToward(s);
      });
      return apiJson({ finance: snapshot(store) });
    }

    return apiJson({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return validationErrorResponse(e) ?? apiError(e, "save failed");
  }
}
