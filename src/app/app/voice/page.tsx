import { redirect } from "next/navigation";

/** Voice Mode lives inside the chat so conversations are saved in history. */
export default function Page() {
  redirect("/app/chat?voice=1");
}
