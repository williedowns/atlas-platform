import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQBOAccessToken, getQBORealmId } from "@/lib/qbo/client";

// Returns all active bank/credit-card accounts from QBO so admins can
// map each location to the correct deposit account.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const token = await getQBOAccessToken();
    const realmId = await getQBORealmId();
    const base =
      process.env.QBO_SANDBOX === "true"
        ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
        : "https://quickbooks.api.intuit.com/v3/company";

    // Fetch Bank and Credit Card accounts from QBO
    const query = encodeURIComponent(
      "SELECT * FROM Account WHERE AccountType IN ('Bank', 'Credit Card') AND Active = true MAXRESULTS 200"
    );
    const res = await fetch(`${base}/${realmId}/query?query=${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `QBO error: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const accounts: { id: string; name: string; account_type: string; account_number?: string }[] =
      (data.QueryResponse?.Account ?? []).map((a: any) => ({
        id: a.Id,
        name: a.Name,
        account_type: a.AccountType,
        account_number: a.AcctNum ?? undefined,
      }));

    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
