import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQBOAccessToken, getQBORealmId } from "@/lib/qbo/client";

// Returns all active QBO Locations (Departments) so admins can map
// each platform location to its QBO counterpart for tax allocation.
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

    const query = encodeURIComponent(
      "SELECT * FROM Department WHERE Active = true MAXRESULTS 200"
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
    const departments: { id: string; name: string; fully_qualified_name: string }[] =
      (data.QueryResponse?.Department ?? []).map((d: any) => ({
        id: d.Id,
        name: d.Name,
        fully_qualified_name: d.FullyQualifiedName ?? d.Name,
      }));

    return NextResponse.json({ departments });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
