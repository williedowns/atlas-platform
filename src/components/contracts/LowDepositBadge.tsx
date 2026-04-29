interface Props {
  pct: number;
  threshold?: number;
  size?: "xs" | "sm";
}

/** Amber pill flagging a contract whose deposit fell below the suggested threshold. */
export function LowDepositBadge({ pct, threshold = 0.30, size = "sm" }: Props) {
  const sizeCls = size === "xs" ? "text-[10px]" : "text-xs";
  const pctLabel = `${(pct * 100).toFixed(0)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold border bg-amber-100 text-amber-800 border-amber-300 ${sizeCls}`}
      title={`Deposit ${pctLabel} of contract total — below the ${(threshold * 100).toFixed(0)}% suggested minimum`}
    >
      Low Deposit · {pctLabel}
    </span>
  );
}
