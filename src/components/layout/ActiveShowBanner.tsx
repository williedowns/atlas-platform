import Link from "next/link";
import { getActiveWorkspace } from "@/lib/active-show";

export default async function ActiveShowBanner() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return null;

  const subtitle =
    workspace.type === "show"
      ? workspace.totalDays > 1
        ? `Day ${workspace.dayNum} of ${workspace.totalDays}`
        : "Active"
      : `${workspace.city}, ${workspace.state}`;

  const changeHref =
    workspace.type === "show" ? `/shows/${workspace.id}` : "/select-active-show";

  return (
    <div className="bg-[#00929C] text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse flex-shrink-0" />
        <span className="font-semibold truncate">{workspace.name}</span>
        <span className="opacity-80 text-xs whitespace-nowrap">· {subtitle}</span>
      </div>
      <Link
        href={changeHref}
        className="text-xs underline opacity-90 hover:opacity-100 flex-shrink-0 ml-2"
      >
        change
      </Link>
    </div>
  );
}
