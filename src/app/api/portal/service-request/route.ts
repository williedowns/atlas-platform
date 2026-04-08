import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await req.json();
  const { equipment_id, description, urgency, contact_method } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const { data: request, error } = await supabase
    .from("service_requests")
    .insert({
      customer_id: customer.id,
      equipment_id: equipment_id || null,
      description: description.trim(),
      urgency: urgency || "routine",
      contact_method: contact_method || "phone",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin via email (best-effort)
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (adminEmail) {
    const urgencyLabel = urgency === "emergency" ? "EMERGENCY" : urgency === "urgent" ? "Urgent" : "Routine";
    await resend.emails.send({
      from: process.env.INVITE_FROM_EMAIL ?? "team@atlasswimspas.com",
      to: adminEmail,
      subject: `[${urgencyLabel}] New Service Request — ${customer.first_name} ${customer.last_name}`,
      html: `
        <p><strong>Customer:</strong> ${customer.first_name} ${customer.last_name}</p>
        <p><strong>Urgency:</strong> ${urgencyLabel}</p>
        <p><strong>Preferred Contact:</strong> ${contact_method}</p>
        <p><strong>Description:</strong></p>
        <blockquote>${description.trim().replace(/\n/g, "<br>")}</blockquote>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/service-requests">View in Admin Panel</a></p>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, id: request.id });
}
