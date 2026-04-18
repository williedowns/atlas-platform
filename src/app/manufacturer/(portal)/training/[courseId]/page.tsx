import Link from "next/link";
import { notFound } from "next/navigation";
import {
  courseById,
  ENROLLMENTS,
  CERTIFICATIONS,
  COURSE_CATEGORY_LABELS,
  COURSE_CATEGORY_COLORS,
} from "@/lib/manufacturer/mock-data";
import { MS_BRAND } from "@/lib/manufacturer/brand";

const fmtDate = (d?: Date) =>
  d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = courseById(courseId);
  if (!course) notFound();

  const catColor = COURSE_CATEGORY_COLORS[course.category];
  const enrollments = ENROLLMENTS.filter((e) => e.courseId === course.id);
  const completedEnrollments = enrollments.filter((e) => e.status === "completed");
  const inProgress = enrollments.filter((e) => e.status === "in_progress");

  const scoredEnrollments = completedEnrollments.filter((e) => e.score !== undefined);
  const avgScore = scoredEnrollments.length > 0
    ? scoredEnrollments.reduce((s, e) => s + (e.score ?? 0), 0) / scoredEnrollments.length
    : 0;

  // Certifications that include this course
  const linkedCerts = CERTIFICATIONS.filter((c) => c.requiredCourses.includes(course.id));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/manufacturer/training" className="hover:text-cyan-700">Training</Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{course.title}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-900">{course.title}</h2>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ color: catColor, backgroundColor: `${catColor}18` }}
            >
              {COURSE_CATEGORY_LABELS[course.category]}
            </span>
            {course.required && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                Required
              </span>
            )}
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 capitalize">
              {course.level.replace("_", " ")}
            </span>
          </div>
          <p className="text-slate-600 mt-2 max-w-3xl">{course.description}</p>
          <div className="flex items-center gap-5 text-xs text-slate-500 mt-3">
            <span>
              <span className="text-slate-400">Code: </span>
              <span className="font-mono text-slate-700">{course.code}</span>
            </span>
            <span>
              <span className="text-slate-400">Lessons: </span>
              <span className="font-semibold text-slate-700">{course.lessons}</span>
            </span>
            <span>
              <span className="text-slate-400">Duration: </span>
              <span className="font-semibold text-slate-700">
                {Math.floor(course.durationMin / 60)}h {course.durationMin % 60}m
              </span>
            </span>
            <span>
              <span className="text-slate-400">Published: </span>
              <span className="text-slate-700">{fmtDate(course.publishedAt)}</span>
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Course Rating</p>
          <p className="text-4xl font-black mt-1 tabular-nums text-amber-500">{course.rating.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">{course.enrolled} learners rated</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Enrolled</p>
          <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: MS_BRAND.colors.accent }}>
            {course.enrolled}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Completed</p>
          <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: MS_BRAND.colors.success }}>
            {course.completed}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Completion Rate</p>
          <p className="text-2xl font-black mt-1 tabular-nums text-slate-900">
            {course.completionRate.toFixed(0)}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pass Rate</p>
          <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: MS_BRAND.colors.primary }}>
            {course.passRate.toFixed(0)}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg Score</p>
          <p className="text-2xl font-black mt-1 tabular-nums text-slate-900">
            {avgScore > 0 ? avgScore.toFixed(0) : "—"}
          </p>
        </div>
      </div>

      {/* Linked certifications */}
      {linkedCerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-3">Required For These Certifications</h3>
          <div className="grid grid-cols-2 gap-3">
            {linkedCerts.map((c) => {
              const color = COURSE_CATEGORY_COLORS[c.category];
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-slate-200 p-3 flex items-center gap-3"
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-widest flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    CERT
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{c.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.unlocks}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {c.requiredCourses.length} required · valid {c.validMonths}mo
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar + counts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900">Completion Funnel</h3>
          <p className="text-xs text-slate-500">
            {course.enrolled} enrolled · {inProgress.length} in progress · {course.completed} completed
          </p>
        </div>
        <div className="flex h-8 rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-center text-white text-xs font-bold"
            style={{
              width: `${(course.completed / Math.max(1, course.enrolled)) * 100}%`,
              backgroundColor: MS_BRAND.colors.success,
            }}
          >
            {course.completed > 0 && `Completed ${course.completed}`}
          </div>
          <div
            className="flex items-center justify-center text-white text-xs font-bold"
            style={{
              width: `${(inProgress.length / Math.max(1, course.enrolled)) * 100}%`,
              backgroundColor: MS_BRAND.colors.accent,
            }}
          >
            {inProgress.length > 0 && `In progress ${inProgress.length}`}
          </div>
          <div
            className="flex items-center justify-center text-slate-700 text-xs font-bold bg-slate-200"
            style={{
              width: `${Math.max(0, (course.enrolled - course.completed - inProgress.length) / Math.max(1, course.enrolled)) * 100}%`,
            }}
          >
            {course.enrolled - course.completed - inProgress.length > 0 &&
              `Not started ${course.enrolled - course.completed - inProgress.length}`}
          </div>
        </div>
      </div>

      {/* Recent enrollments */}
      {enrollments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Recent Enrollments</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Last {Math.min(30, enrollments.length)} learners enrolled in this course
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Learner</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Dealer</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Progress</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Score</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.slice(0, 30).map((e) => {
                const color = e.status === "completed" ? "#059669" : e.status === "in_progress" ? "#0891B2" : "#94A3B8";
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2 font-semibold text-slate-800 text-sm">{e.profileName}</td>
                    <td className="px-5 py-2">
                      <Link href={`/manufacturer/dealers/${e.dealerId}`} className="text-sm text-slate-700 hover:text-cyan-700">
                        {e.dealerName}
                      </Link>
                    </td>
                    <td className="px-5 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider capitalize"
                        style={{ color, backgroundColor: `${color}18` }}
                      >
                        {e.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-xs">
                      {e.progress}%
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-semibold tabular-nums">
                      {e.score !== undefined ? `${e.score}` : "—"}
                    </td>
                    <td className="px-5 py-2 text-xs text-slate-500 tabular-nums">
                      {e.completedAt ? fmtDate(e.completedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
