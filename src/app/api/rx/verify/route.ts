import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sniffMediaType, verifyPrescriptionDocument } from "@/lib/rx-verification";

// POST /api/rx/verify
// Advisory, read-only endpoint: classify an uploaded file as a prescription
// (Rx) vs a driver's license / ID / photo / other, using Claude vision. It
// makes NO database changes — it exists so Step 5 of the sale flow can give the
// salesperson immediate feedback the moment they pick a file, before signing.
//
// The authoritative gate (and the audit trail) lives on /api/customers/[id]/rx,
// which re-runs the same verification at upload time. This endpoint is purely
// UX, and its verdict is produced by the exact same library call, so the
// preview here matches what the upload gate will decide.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Staff-only: Rx uploads originate from the sales floor. This also stops an
  // unauthenticated caller from running up AI verification costs.
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffProfile?.role) {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // True type from magic bytes — never trust the filename/MIME. A null sniff
  // (not an image/PDF) is handed to the lib as an unsupported type; the lib
  // returns ranAi=false only when there's no API key, so an unsupported file
  // still reads as "not a prescription" when the feature is active.
  const mediaType = sniffMediaType(bytes) ?? "application/octet-stream";

  const base64Data = Buffer.from(bytes).toString("base64");
  const result = await verifyPrescriptionDocument(base64Data, mediaType);

  return NextResponse.json(result);
}
