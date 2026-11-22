import { redirect } from "next/navigation";

/** `/` is the new-run screen. */
export default function Home(): never {
  redirect("/runs/new");
}
