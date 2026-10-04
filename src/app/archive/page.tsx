import { redirect } from "next/navigation";

/** Archive hub removed — keep path from breaking old links. */
export default function ArchiveRedirect() {
  redirect("/calendar");
}
