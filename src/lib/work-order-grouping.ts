// Day-grouping helper for the admin work orders list.
// Mobile-first: stack of day sections, sticky headers, crew load count.
//
// scheduled_date is a Postgres `date` rendered 'YYYY-MM-DD' with no tz.
// "Today"/"Tomorrow" labels use America/Chicago via lib/dates so a late-night
// user in any tz still sees Atlas's business-day labels.

import { todayDateStringInTZ, dateStringInTZOffsetDays, formatDayShort } from "@/lib/dates";

export interface OrderLike {
  id: string;
  scheduled_date: string | null;
  scheduled_window?: string | null;
  assigned_crew_ids?: string[] | null;
}

export interface DayGroup<T extends OrderLike> {
  dateKey: string;
  label: string;
  orders: T[];
  crewLoad: number;
}

function relativeLabel(dateKey: string, today: string, tomorrow: string): string {
  if (dateKey === "unscheduled") return "Unscheduled";
  if (dateKey === today) return "Today";
  if (dateKey === tomorrow) return "Tomorrow";
  return formatDayShort(dateKey);
}

export function groupByDay<T extends OrderLike>(orders: T[]): DayGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const o of orders) {
    const key = o.scheduled_date ?? "unscheduled";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(o);
  }

  const today = todayDateStringInTZ();
  const tomorrow = dateStringInTZOffsetDays(1);

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === "unscheduled") return -1;
    if (b === "unscheduled") return 1;
    return a.localeCompare(b);
  });

  return sortedKeys.map((dateKey) => {
    const dayOrders = buckets.get(dateKey)!.sort((a, b) => {
      const aw = (a.scheduled_window ?? "").toLowerCase();
      const bw = (b.scheduled_window ?? "").toLowerCase();
      return aw.localeCompare(bw);
    });
    const crewLoad = dayOrders.reduce(
      (sum, o) => sum + (Array.isArray(o.assigned_crew_ids) ? o.assigned_crew_ids.length : 0),
      0,
    );
    return {
      dateKey,
      label: relativeLabel(dateKey, today, tomorrow),
      orders: dayOrders,
      crewLoad,
    };
  });
}
