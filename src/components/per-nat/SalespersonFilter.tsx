"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

interface Props {
  options: Option[];
  current: string | null;
}

export default function SalespersonFilter({ options, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "") next.delete("salesperson_id");
    else next.set("salesperson_id", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">Salesperson:</span>
      <select
        value={current ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C]/30"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
