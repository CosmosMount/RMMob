import { redirect } from "next/navigation";

/** Legacy /robots index — robots live under each school now. */
export default function RobotsRedirectPage() {
  redirect("/teams");
}
