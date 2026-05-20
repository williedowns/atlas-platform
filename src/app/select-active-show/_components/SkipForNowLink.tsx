import { dismissPickerAction } from "../_actions";

export default function SkipForNowLink({ label = "Skip for now" }: { label?: string }) {
  return (
    <form action={dismissPickerAction}>
      <button
        type="submit"
        className="text-sm text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
      >
        {label}
      </button>
    </form>
  );
}
