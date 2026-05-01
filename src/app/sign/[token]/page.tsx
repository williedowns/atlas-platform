export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import RemoteSignForm from "@/components/contracts/RemoteSignForm";

export default async function RemoteSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, total, deposit_amount, line_items,
      signing_token, signing_token_expires_at,
      customer:customers(first_name, last_name, email)
    `)
    .eq("signing_token", token)
    .maybeSingle();

  if (!contract) {
    return (
      <SignPageShell title="Link not found">
        <p className="text-slate-600 leading-relaxed">
          This signing link is no longer valid. It may have already been used or rotated.
          Please contact your Atlas Spas sales rep for a new link.
        </p>
      </SignPageShell>
    );
  }

  const expiresAt = contract.signing_token_expires_at ? new Date(contract.signing_token_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return (
      <SignPageShell title="Link expired">
        <p className="text-slate-600 leading-relaxed">
          This signing link has expired. Please contact your Atlas Spas sales rep to send you a fresh link.
        </p>
      </SignPageShell>
    );
  }

  if (contract.status !== "quote") {
    return (
      <SignPageShell title="Already signed">
        <p className="text-slate-600 leading-relaxed">
          Contract <span className="font-semibold">{contract.contract_number}</span> has already been signed.
          Check your email for the welcome message.
        </p>
      </SignPageShell>
    );
  }

  const customerRel = contract.customer as
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | { first_name?: string | null; last_name?: string | null; email?: string | null }[]
    | null;
  const customer = Array.isArray(customerRel) ? customerRel[0] : customerRel;

  const lineItems = Array.isArray(contract.line_items)
    ? (contract.line_items as Array<{ product_name?: string; waived?: boolean }>)
    : [];
  const productNames = lineItems
    .filter((i) => !i.waived && typeof i.product_name === "string")
    .map((i) => i.product_name as string);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] text-white px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Atlas Spas &amp; Swim Spas</p>
        <h1 className="text-base font-bold mt-0.5">Sign your contract</h1>
      </header>
      <main className="px-4 pt-5">
        <RemoteSignForm
          token={token}
          contractNumber={contract.contract_number}
          customerFirstName={customer?.first_name ?? "there"}
          customerLastName={customer?.last_name ?? ""}
          productNames={productNames}
          total={Number(contract.total)}
          depositAmount={Number(contract.deposit_amount ?? 0)}
        />
      </main>
    </div>
  );
}

function SignPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold mb-2">Atlas Spas</p>
        <h1 className="text-xl font-black text-slate-900 mb-3">{title}</h1>
        {children}
      </div>
    </div>
  );
}
