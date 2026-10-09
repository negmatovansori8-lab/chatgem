import { redirect } from "next/navigation";

export default async function Page({ searchParams }: PageProps<"/app/profile">) {
  const { section, panel } = await searchParams;
  const target = [section, panel].flat().find((v): v is string => typeof v === "string");
  redirect(target ? `/app/settings?section=${encodeURIComponent(target)}` : "/app/settings");
}
