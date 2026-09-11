import { redirect } from "next/navigation";

/** Projects surface is parked — cycle is Goal → Plan → Today. */
export default function ProjectsPage() {
  redirect("/goals");
}
