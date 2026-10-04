import { redirect } from "next/navigation";

/** Focus lives on the Map now. */
export default function DirectionsRedirect() {
  redirect("/map");
}
