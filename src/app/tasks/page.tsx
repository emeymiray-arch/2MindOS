import { redirect } from "next/navigation";

/** Задачи живут на Главной (Сегодня). */
export default function TasksPage() {
  redirect("/");
}
