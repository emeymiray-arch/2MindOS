import { redirect } from "next/navigation";

/** «Ещё» убрана — всё перенесено в Inbox. */
export default function LifePage() {
  redirect("/inbox");
}
