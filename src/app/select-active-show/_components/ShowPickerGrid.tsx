"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ShowOption {
  type: "show";
  id: string;
  name: string;
  venue_name: string;
  city: string;
  state: string;
  dateLabel: string;
}

interface ShowroomOption {
  type: "location";
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

type PickerOption = ShowOption | ShowroomOption;
type Mode = "shows" | "showrooms";

export default function ShowPickerGrid({
  shows,
  showrooms,
}: {
  shows: ShowOption[];
  showrooms: ShowroomOption[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Always default to Shows — reps think "show first" even on days when
  // none are running. They can tap to Showrooms if they're at a store.
  const [mode, setMode] = useState<Mode>("shows");

  const handlePick = async (option: PickerOption) => {
    if (pendingId) return;
    setPendingId(option.id);

    const body =
      option.type === "show"
        ? { show_id: option.id }
        : { location_id: option.id };

    const res = await fetch("/api/active-show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setPendingId(null);
      const data = await res.json().catch(() => ({}));
      alert(`Failed: ${data.error ?? "Unknown error"}`);
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  const visible: PickerOption[] = mode === "shows" ? shows : showrooms;

  return (
    <div className="space-y-5">
      {/* Segmented toggle — matches the Step1Show contract creation pattern,
          adjusted for the dark picker background. */}
      <div className="inline-flex rounded-xl p-1 bg-white/10 w-full">
        <button
          type="button"
          onClick={() => setMode("shows")}
          disabled={pendingId !== null}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "shows"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-white/60 hover:text-white"
          }`}
        >
          Shows {shows.length > 0 ? `(${shows.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setMode("showrooms")}
          disabled={pendingId !== null}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "showrooms"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-white/60 hover:text-white"
          }`}
        >
          Showrooms {showrooms.length > 0 ? `(${showrooms.length})` : ""}
        </button>
      </div>

      {/* Cards for the active mode */}
      {visible.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-base text-slate-300">
            {mode === "shows"
              ? "No shows running today."
              : "No showrooms set up yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((option) => {
            const isPending = pendingId === option.id;
            const isDisabled = pendingId !== null;

            return (
              <button
                key={`${option.type}-${option.id}`}
                type="button"
                onClick={() => handlePick(option)}
                disabled={isDisabled}
                className={`w-full text-left bg-white rounded-2xl p-5 border-2 transition-all touch-manipulation ${
                  isPending
                    ? "border-[#00929C] bg-[#00929C]/5"
                    : "border-transparent hover:border-[#00929C] active:scale-[0.99]"
                } ${isDisabled && !isPending ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 truncate">
                      {option.name}
                    </h3>
                    {option.type === "show" ? (
                      <>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {option.venue_name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {option.city}, {option.state}
                        </p>
                        <p className="text-sm font-medium text-[#00929C] mt-1">
                          {option.dateLabel}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {option.address}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {option.city}, {option.state}
                        </p>
                      </>
                    )}
                  </div>
                  {isPending ? (
                    <svg
                      className="animate-spin h-8 w-8 text-[#00929C] flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
