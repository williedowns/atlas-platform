import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "contract.created"
  | "contract.signed"
  | "contract.status_changed"
  | "contract.cancelled"
  | "payment.collected"
  | "payment.manual_recorded"
  | "inventory.transferred"
  | "user.invited"
  | "customer.created"
  | "cert.uploaded"
  | "cert.marked_received"
  | "contract.refund_marked"
  | "contract.tax_refund_issued"
  | "lead.created"
  | "lead.status_changed";

interface LogActionParams {
  userId: string;
  action: AuditAction;
  entityType: "contract" | "payment" | "inventory_unit" | "customer" | "user";
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const supabase = await createClient();

    const ip =
      params.req?.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      params.req?.headers.get("x-real-ip") ??
      null;

    const userAgent = params.req?.headers.get("user-agent") ?? null;

    await supabase.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch {
    // Audit logging must never crash the main flow
    console.error("[audit] Failed to log action:", params.action);
  }
}
