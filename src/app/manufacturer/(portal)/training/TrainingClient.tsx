"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type Course,
  type CourseCategory,
  type Certification,
  type RepCertification,
  type Enrollment,
  type ContentAsset,
  COURSE_CATEGORY_LABELS,
  COURSE_CATEGORY_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";

const fmtDate = (d?: Date) =>
  d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export interface TrainingStats {
  totalCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  inProgressEnrollments: number;
  notStartedEnrollments: number;
  completedThisMonth: number;
  overallCompletionRate: number;
  avgScore: number;
  totalReps: number;
  certifiedCount: number;
  expiringCount: number;
  expiredCount: number;
  inProgressCount: number;
  totalCertifications: number;
  totalAssets: number;
  totalDownloads: number;
}

export interface DealerCertRow {
  dealer: { id: string; name: string; city: string; state: string; tier: string };
  totalReps: number;
  fullyCertifiedReps: number;
  expiringReps: number;
  expiredReps: number;
}

const CATEGORY_TABS: (CourseCategory | "all")[] = [
  "all", "onboarding", "product", "sales", "service", "compliance", "brand",
];

export default function TrainingClient({
  courses,
  stats,
  certifications,
  dealerCertStatus,
  expiringRepCerts,
  recentEnrollments,
  contentAssets,
  categoryCounts,
}: {
  courses: Course[];
  stats: TrainingStats;
  certifications: Certification[];
  dealerCertStatus: DealerCertRow[];
  expiringRepCerts: RepCertification[];
  recentEnrollments: Enrollment[];
  contentAssets: ContentAsset[];
  categoryCounts: Record<CourseCategory, number>;
}) {
  const [categoryFilter, setCategoryFilter] = useState<CourseCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [requiredOnly, setRequiredOnly] = useState(false);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (requiredOnly && !c.required) return false;
      if (search && !`${c.title} ${c.code}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [courses, categoryFilter, search, requiredOnly]);

  // Top 5 most enrolled courses
  const topCourses = [...courses].sort((a, b) => b.enrolled - a.enrolled).slice(0, 5);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Training & Certification</h2>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ backgroundColor: MS_BRAND.colors.primary }}
            >
              Module 6 · Dealer Enablement
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dealer onboarding, product training, rep certifications, and the brand content library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.expiredCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {stats.expiredCount} certifications expired
            </div>
          )}
          {stats.expiringCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
              {stats.expiringCount} expiring soon
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Certified Reps"
          value={stats.certifiedCount.toLocaleString()}
          sublabel={`${stats.totalReps} total dealer reps on platform`}
          trend="up"
          trendValue={`${((stats.certifiedCount / Math.max(1, stats.totalReps)) * 100).toFixed(0)}%`}
          accentColor={MS_BRAND.colors.success}
          size="lg"
        />
        <KpiCard
          label="Completion Rate"
          value={`${stats.overallCompletionRate}%`}
          sublabel={`${stats.completedThisMonth} courses completed last 30d`}
          trend={stats.overallCompletionRate >= 60 ? "up" : "down"}
          trendValue={stats.overallCompletionRate >= 60 ? "healthy" : "watch"}
          accentColor={stats.overallCompletionRate >= 60 ? MS_BRAND.colors.accent : MS_BRAND.colors.warning}
          size="lg"
        />
        <KpiCard
          label="Courses Published"
          value={stats.totalCourses}
          sublabel={`${stats.totalEnrollments.toLocaleString()} total enrollments`}
          accentColor={MS_BRAND.colors.primary}
          size="lg"
        />
        <KpiCard
          label="Content Library"
          value={stats.totalAssets}
          sublabel={`${stats.totalDownloads.toLocaleString()} downloads YTD`}
          accentColor={MS_BRAND.colors.warning}
          size="lg"
        />
      </div>

      {/* Certification urgency banner */}
      {(stats.expiringCount > 0 || stats.expiredCount > 0) && (
        <SectionCard
          title="Certification Urgency"
          subtitle={`${stats.expiringCount + stats.expiredCount} rep certification${stats.expiringCount + stats.expiredCount !== 1 ? "s" : ""} need action`}
        >
          <div className="divide-y divide-slate-100">
            {expiringRepCerts.slice(0, 6).map((rc) => {
              const color = rc.status === "expired" ? "#DC2626" : "#D97706";
              const daysText = rc.expiresAt
                ? Math.round((rc.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                : 0;
              return (
                <div key={rc.id} className="py-3 flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest"
                    style={{ backgroundColor: color }}
                  >
                    {rc.status === "expired" ? "EXP" : "SOON"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {rc.profileName} <span className="text-slate-500 font-normal">· {rc.profileRole}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {rc.certificationTitle}
                      <span className="text-slate-400"> · </span>
                      <Link href={`/manufacturer/dealers/${rc.dealerId}`} className="hover:text-cyan-700">
                        {rc.dealerName}
                      </Link>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums" style={{ color }}>
                      {rc.status === "expired"
                        ? `Expired ${Math.abs(daysText)}d ago`
                        : `${daysText}d left`}
                    </p>
                    <p className="text-[10px] text-slate-500">Expires {fmtDate(rc.expiresAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Certifications overview */}
      <SectionCard
        title="Certification Programs"
        subtitle="Every cert pathway + what it unlocks"
      >
        <div className="grid grid-cols-2 gap-3">
          {certifications.map((cert) => {
            const categoryColor = COURSE_CATEGORY_COLORS[cert.category];
            const issuedCount = expiringRepCerts.filter((r) => r.certificationId === cert.id).length;
            return (
              <div key={cert.id} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: categoryColor, backgroundColor: `${categoryColor}15` }}
                      >
                        {COURSE_CATEGORY_LABELS[cert.category]}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{cert.code}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1">{cert.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cert.unlocks}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 text-[11px]">
                  <span className="text-slate-500">{cert.requiredCourses.length} required course{cert.requiredCourses.length !== 1 ? "s" : ""}</span>
                  <span className="text-slate-500">Valid {cert.validMonths}mo</span>
                  <span className="font-semibold text-slate-700">{issuedCount} reps</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title="Dealer Certification Status"
          subtitle="Dealers with gaps in rep certification coverage"
        >
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-auto">
            {dealerCertStatus.slice(0, 15).map((d) => {
              const coverageRate = d.totalReps > 0 ? (d.fullyCertifiedReps / d.totalReps) * 100 : 0;
              const color = coverageRate >= 80 ? "#059669" : coverageRate >= 50 ? "#D97706" : "#DC2626";
              return (
                <Link
                  key={d.dealer.id}
                  href={`/manufacturer/dealers/${d.dealer.id}`}
                  className="py-2.5 flex items-center gap-3 hover:bg-slate-50 rounded px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{d.dealer.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {d.dealer.city}, {d.dealer.state} · {d.dealer.tier} · {d.totalReps} reps
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm tabular-nums" style={{ color }}>
                      {coverageRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {d.fullyCertifiedReps}/{d.totalReps} fully certified
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Enrollment Activity"
          subtitle="Who's learning what"
        >
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-auto">
            {recentEnrollments.slice(0, 15).map((e) => {
              const color = e.status === "completed" ? "#059669" : e.status === "in_progress" ? "#0891B2" : "#94A3B8";
              return (
                <div key={e.id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{e.profileName}</p>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest capitalize"
                      style={{ color, backgroundColor: `${color}18` }}
                    >
                      {e.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {e.courseTitle}
                    <span className="text-slate-400"> · </span>
                    {e.dealerName}
                  </p>
                  {e.status === "in_progress" && (
                    <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${e.progress}%`, backgroundColor: color }} />
                    </div>
                  )}
                  {e.status === "completed" && e.score !== undefined && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Scored {e.score}% · {fmtDate(e.completedAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Content library */}
      <SectionCard
        title="Content Library"
        subtitle={`${stats.totalAssets} assets · ${stats.totalDownloads.toLocaleString()} total downloads · dealer self-serve`}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {contentAssets.slice(0, 12).map((a) => {
            const typeColor =
              a.type === "video" ? "#DC2626"
              : a.type === "pdf" ? "#0891B2"
              : a.type === "image" ? "#059669"
              : a.type === "ad_template" ? "#D97706"
              : "#7C3AED";
            return (
              <div key={a.id} className="rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-widest flex-shrink-0"
                    style={{ backgroundColor: typeColor }}
                  >
                    {a.type.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{a.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {(a.sizeKb / 1000).toFixed(1)}MB · {a.downloads} downloads · {fmtDate(a.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Courses */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {CATEGORY_TABS.map((cat) => {
          const label = cat === "all" ? "All Courses" : COURSE_CATEGORY_LABELS[cat];
          const count = cat === "all" ? courses.length : categoryCounts[cat];
          const active = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? "text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={active ? { backgroundColor: MS_BRAND.colors.primary } : {}}
            >
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search course title or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[260px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={requiredOnly}
            onChange={(e) => setRequiredOnly(e.target.checked)}
            className="rounded"
          />
          Required only
        </label>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} course{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Course</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Category</th>
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Level</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Lessons</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Duration</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Enrolled</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Completion</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 150).map((c) => {
              const catColor = COURSE_CATEGORY_COLORS[c.category];
              const compColor = c.completionRate >= 70 ? "#059669" : c.completionRate >= 50 ? "#D97706" : "#DC2626";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/manufacturer/training/${c.id}`}
                      className="font-semibold text-slate-900 hover:text-cyan-700"
                    >
                      {c.title}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                      {c.required && (
                        <span className="inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{ color: catColor, backgroundColor: `${catColor}15` }}
                    >
                      {COURSE_CATEGORY_LABELS[c.category]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700 capitalize">
                    {c.level.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">{c.lessons}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-600 tabular-nums">
                    {Math.floor(c.durationMin / 60)}h {c.durationMin % 60}m
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.enrolled}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: compColor }}>
                    {c.completionRate.toFixed(0)}%
                  </td>
                  <td className="px-5 py-3 text-right text-xs tabular-nums text-amber-500">
                    {c.rating.toFixed(1)} ★
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top courses callout (below table for visual interest) */}
      <div className="text-xs text-slate-500 text-center">
        Top enrolled: {topCourses.map((c) => c.title).slice(0, 3).join(" · ")}
      </div>
    </div>
  );
}
