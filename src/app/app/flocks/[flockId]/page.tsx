import {redirect} from "next/navigation";

export default async function FlockDetailPage({params, searchParams}: {
  params: Promise<{flockId: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {flockId} = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
    else if (value !== undefined) query.set(key, value);
  }
  query.set("flock", flockId);
  query.set("details", "1");
  query.set("filter_page_tab", "overview");
  // The workspace/profile read authorizes the requested target. Never redirect
  // to a guessed active flock, and retain finding/Governance return context.
  redirect(`/app/flocks?${query}`);
}
