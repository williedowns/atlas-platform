"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Show, Location } from "@/types";

interface Step1ShowProps {
  onNext: () => void;
}

export default function Step1Show({ onNext }: Step1ShowProps) {
  const [shows, setShows] = useState<Show[]>([]);
  const [storeLocations, setStoreLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"shows" | "store">("shows");

  const { setShow } = useContractStore();
  const currentShowId = useContractStore((s) => s.draft.show_id);

  useEffect(() => {
    setSelectedId(currentShowId ?? null);
  }, [currentShowId]);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const [showsResult, locationsResult] = await Promise.all([
        supabase
          .from("shows")
          .select("*, location:locations(*)")
          .eq("active", true)
          .order("start_date", { ascending: true }),
        supabase
          .from("locations")
          .select("*")
          .eq("type", "store")
          .eq("active", true)
          .order("name"),
      ]);

      if (showsResult.data) setShows(showsResult.data as Show[]);
      if (locationsResult.data)
        setStoreLocations(locationsResult.data as Location[]);
      setLoading(false);
    }

    fetchData();
  }, []);

  function handleSelectShow(show: Show) {
    // Only pass a real DB location (one with a valid locations-table ID).
    // If the show has no linked location record, pass null so location_id stays
    // null in the contract and doesn't violate the FK constraint.
    const location = (show.location as Location) ?? null;
    setSelectedId(show.id);
    setShow(show, location);
    onNext();
  }

  function handleSelectStore(location: Location) {
    const storeShow: Show = {
      id: `store-${location.id}`,
      name: `Store Sale - ${location.name}`,
      location_id: location.id,
      location,
      venue_name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      start_date: new Date().toISOString(),
      end_date: new Date().toISOString(),
      assigned_rep_ids: [],
      active: true,
      created_at: new Date().toISOString(),
    };
    setSelectedId(storeShow.id);
    setShow(storeShow, location);
    onNext();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-10 w-10 text-[#00929C]"
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
          <p className="text-lg text-slate-500">Loading shows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 1 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">
          Where is this sale happening?
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Pick an active show or select a store location.
        </p>
      </div>

      {/* Segmented mode toggle */}
      <div className="inline-flex rounded-xl p-1 bg-slate-100 w-full">
        <button
          type="button"
          onClick={() => setMode("shows")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "shows"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Active Shows
        </button>
        <button
          type="button"
          onClick={() => setMode("store")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "store"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Store Sale
        </button>
      </div>

      {mode === "shows" && (
        <div className="space-y-3">
          {shows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-lg text-slate-500">
                  No active shows. Contact your manager.
                </p>
              </CardContent>
            </Card>
          ) : (
            shows.map((show) => {
              const isSelected = selectedId === show.id;
              const location = show.location as Location | undefined;
              return (
                <Card
                  key={show.id}
                  className={`cursor-pointer transition-all active:scale-[0.99] touch-manipulation ${
                    isSelected
                      ? "ring-2 ring-[#00929C] border-[#00929C] bg-[#00929C]/5"
                      : "hover:border-slate-300"
                  }`}
                  onClick={() => handleSelectShow(show)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">
                        {show.name}
                      </h3>
                      <p className="text-base text-slate-600 mt-0.5">
                        {show.venue_name}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {show.city}, {show.state}
                      </p>
                      <p className="text-sm font-medium text-[#00929C] mt-1">
                        {formatDate(show.start_date)} &ndash;{" "}
                        {formatDate(show.end_date)}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00929C] flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {mode === "store" && (
        <div className="space-y-3">
          {storeLocations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-lg text-slate-500">
                  No store locations available.
                </p>
              </CardContent>
            </Card>
          ) : (
            storeLocations.map((location) => {
              const isSelected = selectedId === `store-${location.id}`;
              return (
                <Card
                  key={location.id}
                  className={`cursor-pointer transition-all active:scale-[0.99] touch-manipulation ${
                    isSelected
                      ? "ring-2 ring-[#00929C] border-[#00929C] bg-[#00929C]/5"
                      : "hover:border-slate-300"
                  }`}
                  onClick={() => handleSelectStore(location)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">
                        {location.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {location.address}
                      </p>
                      <p className="text-sm text-slate-400">
                        {location.city}, {location.state} {location.zip}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00929C] flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
