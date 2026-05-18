"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RealtimeRefresherProps {
  /** Postgres tables to watch. Changes on any of these → router.refresh(). */
  tables: string[];
  /**
   * Debounce window in ms. Multiple events within this window collapse into
   * one refresh. Defaults to 250ms. Keep low for snappy feel; raise if a
   * heavy server query is being re-run too often.
   */
  debounceMs?: number;
}

/**
 * Subscribes to Supabase Realtime postgres_changes for the given tables.
 * When any row change is received, debounce-refreshes the current route so
 * server components re-fetch fresh data.
 *
 * RLS is enforced on the broadcast side — each client only receives changes
 * for rows it can read. No org-id filter needed here.
 *
 * Tables must be added to the `supabase_realtime` publication beforehand
 * (see migration 062).
 */
export default function RealtimeRefresher({
  tables,
  debounceMs = 250,
}: RealtimeRefresherProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tables.length === 0) return;

    const supabase = createClient();
    const channelName = `realtime-refresher-${tables.join("-")}`;
    const channel = supabase.channel(channelName);

    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.refresh();
      }, debounceMs);
    }

    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [tables, debounceMs, router]);

  return null;
}
