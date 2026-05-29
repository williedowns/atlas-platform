import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";

type DiagramEntry = {
  scenario_id?: number;
  label?: string;
  fields?: Record<string, string>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDiagram(input: unknown): { ok: true; value: DiagramEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: "delivery_diagram must be an array" };
  }
  const out: DiagramEntry[] = [];
  for (let i = 0; i < input.length; i++) {
    const entry = input[i];
    if (!isPlainObject(entry)) {
      return { ok: false, error: `delivery_diagram[${i}] must be an object` };
    }
    const next: DiagramEntry = {};
    if ("scenario_id" in entry && entry.scenario_id !== undefined && entry.scenario_id !== null) {
      if (typeof entry.scenario_id !== "number" || !Number.isFinite(entry.scenario_id)) {
        return { ok: false, error: `delivery_diagram[${i}].scenario_id must be a number` };
      }
      next.scenario_id = entry.scenario_id;
    }
    if ("label" in entry && entry.label !== undefined && entry.label !== null) {
      if (typeof entry.label !== "string") {
        return { ok: false, error: `delivery_diagram[${i}].label must be a string` };
      }
      next.label = entry.label;
    }
    if ("fields" in entry && entry.fields !== undefined && entry.fields !== null) {
      if (!isPlainObject(entry.fields)) {
        return { ok: false, error: `delivery_diagram[${i}].fields must be an object` };
      }
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(entry.fields)) {
        if (typeof k !== "string") {
          return { ok: false, error: `delivery_diagram[${i}].fields keys must be strings` };
        }
        if (typeof v !== "string") {
          return { ok: false, error: `delivery_diagram[${i}].fields["${k}"] must be a string` };
        }
        fields[k] = v;
      }
      next.fields = fields;
    }
    out.push(next);
  }
  return { ok: true, value: out };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager(id);
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = await req.json().catch(() => ({}));
  const validation = validateDiagram((body as { delivery_diagram?: unknown }).delivery_diagram);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const newDiagram = validation.value;

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, delivery_diagram")
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const previousDiagram = contract.delivery_diagram;

  const { error: writeError } = await supabase
    .from("contracts")
    .update({ delivery_diagram: newDiagram })
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.delivery_diagram_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      before: previousDiagram,
      after: newDiagram,
    },
    req,
  });

  return NextResponse.json({ ok: true });
}
