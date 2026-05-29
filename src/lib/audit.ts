import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "contract.created"
  | "contract.signed"
  | "contract.status_changed"
  | "contract.cancelled"
  | "contract.deleted"
  | "contract.submission_failed"
  | "contract.recovered_by_lookup"
  | "contract.idempotent_replay"
  | "contract.signing_link_sent"
  | "contract.remote_signed"
  | "payment.collected"
  | "payment.manual_recorded"
  | "payment.card_saved"
  | "payment.charged_with_saved_card"
  | "payment.ach_ran"
  | "inventory.transferred"
  | "user.invited"
  | "customer.created"
  | "customer.rx_uploaded"
  | "contract.tax_auto_exempted"
  | "cert.uploaded"
  | "cert.marked_received"
  | "contract.refund_marked"
  | "contract.tax_refund_issued"
  | "contract.delivery_timeframe_updated"
  | "contract.per_nat_flagged"
  | "contract.per_nat_unflagged"
  | "contract.inventory_unit_assigned"
  | "contract.inventory_unit_released"
  | "contract.financing_added"
  | "contract.customer_info_updated"
  | "contract.line_items_updated"
  | "contract.discounts_updated"
  | "contract.adjustment_updated"
  | "contract.notes_updated"
  | "contract.assignment_updated"
  | "contract.concrete_assignment_updated"
  | "contract.tax_settings_updated"
  | "contract.delivery_diagram_updated"
  | "lead.created"
  | "lead.status_changed"
  | "verification.check_updated";

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
