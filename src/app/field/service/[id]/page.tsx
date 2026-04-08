"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800", in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800", cancelled: "bg-slate-100 text-slate-600",
};

function fmt(d: string | null) {
  if (!d) return "TBD";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

type Job = any;

export default function FieldServiceJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [job, setJob] = useState<Job | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Water test form
  const [showWaterTest, setShowWaterTest] = useState(false);
  const [waterForm, setWaterForm] = useState({ ph: "", alkalinity: "", sanitizer_ppm: "", temp_f: "", hardness: "", notes: "" });
  const [submittingTest, setSubmittingTest] = useState(false);
  const [testSaved, setTestSaved] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; storage_url: string; caption: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("service_jobs")
      .select("*, customer:customers(first_name,last_name,email,phone), equipment:equipment(product_name,serial_number), assigned_tech:profiles(full_name), water_tests:service_job_water_tests(*), photos:service_job_photos(*)")
      .eq("id", id).single();
    setJob(data);
    setPhotos(data?.photos ?? []);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas drawing
  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
    setIsDrawing(true);
    setHasSig(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#010F21";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearSig() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function submitWaterTest(e: React.FormEvent) {
    e.preventDefault();
    const vals = Object.fromEntries(
      Object.entries(waterForm).map(([k, v]) => [k, v.trim() === "" ? null : (k === "notes" ? v.trim() : Number(v))])
    );
    if (!vals.ph && !vals.sanitizer_ppm && !vals.temp_f) return;
    setSubmittingTest(true);
    await fetch(`/api/service-jobs/${id}/water-test`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals),
    });
    setTestSaved(true);
    setSubmittingTest(false);
    setShowWaterTest(false);
    setWaterForm({ ph: "", alkalinity: "", sanitizer_ppm: "", temp_f: "", hardness: "", notes: "" });
    await load();
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `service/${id}/${Date.now()}.${ext}`;
    const { data: uploadData, error } = await supabase.storage.from("service-photos").upload(path, file, { upsert: false });
    if (error) { setUploadingPhoto(false); alert("Upload failed: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("service-photos").getPublicUrl(uploadData.path);
    await fetch(`/api/service-jobs/${id}/photos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_url: urlData.publicUrl }),
    });
    await load();
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function completeJob() {
    if (!hasSig) { alert("Please provide a customer signature before completing."); return; }
    setSaving(true);
    await fetch(`/api/service-jobs/${id}/complete`, { method: "POST" });
    setSaving(false);
    setCompleted(true);
  }

  if (!job) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Loading…</p>
    </div>
  );

  if (completed) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Job Complete!</h2>
        <p className="text-slate-500 text-sm mb-6">The customer has been notified.</p>
        <Link href="/field?tab=service">
          <Button variant="primary" size="lg">Back to Service Jobs</Button>
        </Link>
      </div>
    </div>
  );

  const customer = job.customer;
  const equipment = job.equipment;
  const waterTests: any[] = job.water_tests ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/field?tab=service" className="p-2 rounded-lg hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <h1 className="text-base font-bold truncate max-w-[200px]">{job.title}</h1>
              <p className="text-white/60 text-xs">{job.job_type?.replace("_", " ")}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[job.status] ?? "bg-slate-100 text-slate-600"}`}>
            {job.status?.replace("_", " ")}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-32 space-y-4">
        {/* Job details */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{customer?.first_name} {customer?.last_name}</p>
                {customer?.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
                {customer?.email && <p className="text-sm text-slate-500">{customer.email}</p>}
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-900">{fmt(job.scheduled_date)}</p>
                {job.scheduled_time_start && (
                  <p className="text-slate-500">{job.scheduled_time_start.slice(0,5)}{job.scheduled_time_end ? ` – ${job.scheduled_time_end.slice(0,5)}` : ""}</p>
                )}
              </div>
            </div>
            {equipment && (
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium">Equipment:</span> {equipment.product_name}
                {equipment.serial_number && <span className="text-slate-400"> · S/N: {equipment.serial_number}</span>}
              </div>
            )}
            {job.description && <p className="text-sm text-slate-600">{job.description}</p>}
          </CardContent>
        </Card>

        {/* Start job if scheduled */}
        {job.status === "scheduled" && (
          <Button variant="primary" size="lg" className="w-full" onClick={async () => {
            await fetch(`/api/service-jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "in_progress" }) });
            await load();
          }}>
            Start Job
          </Button>
        )}

        {/* Water test */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Water Test {waterTests.length > 0 && `(${waterTests.length})`}</CardTitle>
            {job.status !== "completed" && (
              <button onClick={() => setShowWaterTest(v => !v)} className="text-sm text-[#00929C] font-medium hover:text-[#007a82]">
                {showWaterTest ? "Cancel" : "+ Log Test"}
              </button>
            )}
          </CardHeader>
          {showWaterTest && (
            <CardContent className="p-4 border-t border-slate-100">
              <form onSubmit={submitWaterTest} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "ph", label: "pH" },
                    { key: "sanitizer_ppm", label: "Sanitizer (ppm)" },
                    { key: "temp_f", label: "Temp (°F)" },
                    { key: "alkalinity", label: "Alkalinity (ppm)" },
                    { key: "hardness", label: "Hardness (ppm)" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
                      <input type="number" step="0.01" value={(waterForm as any)[key]}
                        onChange={e => setWaterForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-slate-300 px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]" />
                    </div>
                  ))}
                  <div className="col-span-3">
                    <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
                    <textarea value={waterForm.notes} onChange={e => setWaterForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C] resize-none" />
                  </div>
                </div>
                <Button type="submit" variant="primary" size="sm" disabled={submittingTest}>
                  {submittingTest ? "Saving…" : "Save Water Test"}
                </Button>
              </form>
            </CardContent>
          )}
          {testSaved && <CardContent className="px-4 pb-3 pt-0"><p className="text-sm text-emerald-600 font-medium">Water test saved!</p></CardContent>}
          {waterTests.length > 0 && (
            <CardContent className="p-0">
              {waterTests.map((t: any, i: number) => (
                <div key={t.id} className={`px-4 py-3 ${i > 0 ? "border-t border-slate-100" : "border-t border-slate-100"}`}>
                  <p className="text-xs text-slate-400 mb-1.5">{new Date(t.tested_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {t.ph != null && <div><span className="text-slate-500 text-xs">pH</span><p className="font-semibold text-slate-900">{t.ph}</p></div>}
                    {t.sanitizer_ppm != null && <div><span className="text-slate-500 text-xs">Sanitizer</span><p className="font-semibold text-slate-900">{t.sanitizer_ppm} ppm</p></div>}
                    {t.temp_f != null && <div><span className="text-slate-500 text-xs">Temp</span><p className="font-semibold text-slate-900">{t.temp_f}°F</p></div>}
                    {t.alkalinity != null && <div><span className="text-slate-500 text-xs">Alkalinity</span><p className="font-semibold text-slate-900">{t.alkalinity}</p></div>}
                    {t.hardness != null && <div><span className="text-slate-500 text-xs">Hardness</span><p className="font-semibold text-slate-900">{t.hardness}</p></div>}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Photos {photos.length > 0 && `(${photos.length})`}</CardTitle>
            {job.status !== "completed" && (
              <button onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="text-sm text-[#00929C] font-medium hover:text-[#007a82] disabled:opacity-50">
                {uploadingPhoto ? "Uploading…" : "+ Add Photo"}
              </button>
            )}
          </CardHeader>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhoto} />
          {photos.length > 0 && (
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p: any) => (
                  <a key={p.id} href={p.storage_url} target="_blank" rel="noopener noreferrer">
                    <img src={p.storage_url} alt={p.caption ?? "Photo"} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            </CardContent>
          )}
          {photos.length === 0 && !uploadingPhoto && (
            <CardContent className="pb-4 pt-0 px-4">
              <p className="text-sm text-slate-400">No photos yet. Tap "Add Photo" to capture.</p>
            </CardContent>
          )}
        </Card>

        {/* Completion checklist */}
        {job.status !== "completed" && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pre-Completion Checklist</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-2">
              {[
                "Equipment inspected and functioning",
                "Water chemistry within acceptable range",
                "Site left clean and tidy",
                "Customer informed of any issues",
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#00929C] focus:ring-[#00929C]" />
                  <span className="text-sm text-slate-700">{item}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Signature capture */}
        {job.status !== "completed" && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Customer Signature</CardTitle>
              {hasSig && (
                <button onClick={clearSig} className="text-xs text-slate-400 hover:text-red-500 font-medium">Clear</button>
              )}
            </CardHeader>
            <CardContent className="p-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full touch-none cursor-crosshair"
                  style={{ touchAction: "none" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">Sign above to confirm service completion</p>
            </CardContent>
          </Card>
        )}

        {/* Complete job button */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white border-t border-slate-200 shadow-lg">
            <Button
              variant="primary" size="xl" className="w-full max-w-2xl mx-auto block"
              disabled={saving || !hasSig}
              onClick={completeJob}>
              {saving ? "Completing…" : hasSig ? "Complete Job" : "Signature Required to Complete"}
            </Button>
          </div>
        )}

        {job.status === "completed" && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Job Completed</p>
                {job.completed_at && <p className="text-xs text-slate-500">{new Date(job.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
