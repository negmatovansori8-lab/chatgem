import { redirect } from "next/navigation";

/** Typing the site name opens the app, not the introduction page. */
export default function HomePage() {
  redirect("/app/chat");
}
