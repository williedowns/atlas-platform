// Email packet sent to Robert Kennedy when a contract is signed with
// In-House Financing. Includes everything Robert needs to set up the loan
// in our internal system.

interface ProductLine {
  product_name?: string;
  serial_number?: string;
  quantity?: number;
  sell_price?: number;
}

export interface InhouseApplicationPayload {
  contractNumber: string;
  contractTotal: number;
  contractUrl: string;

  customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  secondaryBuyer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };

  lineItems: ProductLine[];

  financing: {
    plan_number?: string;
    plan_description?: string;
    financed_amount: number;
    approval_number?: string;
  };

  ach: {
    holder_name?: string;
    routing?: string;
    account?: string;
    bank?: string;
  };

  driversLicenseSignedUrl?: string | null;
  driversLicenseFilename?: string | null;

  signedAt?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

export function buildInhouseApplicationHtml(p: InhouseApplicationPayload): string {
  const customerName = `${p.customer.first_name ?? ""} ${p.customer.last_name ?? ""}`.trim() || "—";
  const customerAddress = [p.customer.address, p.customer.city ? `${p.customer.city}, ${p.customer.state ?? ""} ${p.customer.zip ?? ""}`.trim() : ""]
    .filter(Boolean).join("<br/>");

  const productRows = p.lineItems
    .filter((li) => li.product_name)
    .map((li) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(li.product_name ?? "")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#64748b;">${escapeHtml(li.serial_number ?? "")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${li.quantity ?? 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmt((li.sell_price ?? 0) * (li.quantity ?? 1))}</td>
      </tr>
    `).join("");

  const dlBlock = p.driversLicenseSignedUrl
    ? `
      <p style="margin:0 0 8px;color:#475569;font-size:13px;">
        Driver's License: <a href="${p.driversLicenseSignedUrl}" style="color:#00929C;font-weight:600;">${escapeHtml(p.driversLicenseFilename ?? "View")}</a>
        <span style="color:#94a3b8;font-size:11px;">(link expires in 7 days; download a copy if needed)</span>
      </p>
    `
    : `
      <p style="margin:0 0 8px;color:#b45309;font-size:13px;font-weight:600;">
        ⚠ Driver's License NOT uploaded. Have the salesperson upload it to Customer Files on the contract page.
      </p>
    `;

  const secondary = p.secondaryBuyer && (p.secondaryBuyer.first_name || p.secondaryBuyer.email)
    ? `
      <tr><td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Co-Buyer</td></tr>
      <tr><td style="padding:0 0 12px;color:#0f172a;font-size:14px;">
        ${escapeHtml(`${p.secondaryBuyer.first_name ?? ""} ${p.secondaryBuyer.last_name ?? ""}`.trim() || "—")}<br/>
        <span style="color:#64748b;font-size:13px;">${escapeHtml(p.secondaryBuyer.email ?? "")}</span>
      </td></tr>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>In-House Financing Application</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:640px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#010F21;padding:24px 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">ATLAS SPAS · IN-HOUSE FINANCING APPLICATION</h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">
            Contract <strong style="color:#ffffff;">${escapeHtml(p.contractNumber)}</strong>
            ${p.signedAt ? ` · Signed ${new Date(p.signedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}
          </p>
        </td></tr>
        <tr><td style="height:3px;background:#00929C;"></td></tr>

        <!-- Lead summary -->
        <tr><td style="padding:24px 28px 8px;">
          <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.5;">
            Robert — a contract just signed with In-House Financing. Set up the loan with the info below.
          </p>
        </td></tr>

        <!-- Two columns: Customer + Financing -->
        <tr><td style="padding:8px 28px 4px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" style="width:50%;padding-right:12px;">
                <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;font-weight:700;">Customer</p>
                <p style="margin:0 0 4px;color:#0f172a;font-size:15px;font-weight:600;">${escapeHtml(customerName)}</p>
                <p style="margin:0 0 4px;color:#475569;font-size:13px;">${escapeHtml(p.customer.email ?? "")}</p>
                <p style="margin:0 0 4px;color:#475569;font-size:13px;">${escapeHtml(p.customer.phone ?? "")}</p>
                <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${customerAddress}</p>
                ${secondary ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;">${secondary}</table>` : ""}
              </td>
              <td valign="top" style="width:50%;padding-left:12px;border-left:1px solid #e2e8f0;">
                <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;font-weight:700;">Financing</p>
                <p style="margin:0 0 4px;color:#0f172a;font-size:22px;font-weight:700;">${fmt(p.financing.financed_amount)}</p>
                ${p.financing.plan_number ? `<p style="margin:0 0 4px;color:#475569;font-size:13px;">Plan ${escapeHtml(p.financing.plan_number)}</p>` : ""}
                ${p.financing.plan_description ? `<p style="margin:0 0 4px;color:#475569;font-size:13px;">${escapeHtml(p.financing.plan_description)}</p>` : ""}
                ${p.financing.approval_number ? `<p style="margin:0 0 4px;color:#475569;font-size:13px;">Approval # ${escapeHtml(p.financing.approval_number)}</p>` : ""}
                <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">Contract total: ${fmt(p.contractTotal)}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ACH info card -->
        <tr><td style="padding:16px 28px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f9fa;border:1px solid #00929C33;border-radius:6px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 8px;color:#00929C;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;font-weight:700;">ACH for Withdrawals</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:13px;">
                <tr>
                  <td style="padding:3px 0;color:#64748b;width:140px;">Account Holder</td>
                  <td style="padding:3px 0;color:#0f172a;font-weight:600;">${escapeHtml(p.ach.holder_name ?? "—")}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#64748b;">Routing #</td>
                  <td style="padding:3px 0;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${escapeHtml(p.ach.routing ?? "—")}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#64748b;">Account #</td>
                  <td style="padding:3px 0;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${escapeHtml(p.ach.account ?? "—")}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0;color:#64748b;">Bank</td>
                  <td style="padding:3px 0;color:#0f172a;font-weight:600;">${escapeHtml(p.ach.bank ?? "—")}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Products -->
        <tr><td style="padding:16px 28px 8px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;font-weight:700;">Products</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th align="left" style="padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
                <th align="left" style="padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Serial #</th>
                <th align="center" style="padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                <th align="right" style="padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
              </tr>
            </thead>
            <tbody>${productRows}</tbody>
          </table>
        </td></tr>

        <!-- Driver's License -->
        <tr><td style="padding:16px 28px 8px;">
          <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;font-weight:700;">Driver's License</p>
          ${dlBlock}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:16px 28px 24px;">
          <a href="${p.contractUrl}" style="display:inline-block;background:#00929C;color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px;text-decoration:none;">View Contract in Salta →</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:14px 28px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            Atlas Spas &amp; Swim Spas · Auto-generated by Salta when ${escapeHtml(p.contractNumber)} signed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
