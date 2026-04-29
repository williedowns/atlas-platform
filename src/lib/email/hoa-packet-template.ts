// HOA fair-housing packet email — sent to the customer when their contract is
// flagged needs_hoa. Includes the legal memorandum PDF as an attachment they
// can use when seeking HOA approval.

interface Args {
  customerFirstName?: string;
  contractNumber: string;
  customerPortalUrl: string;
}

export function buildHoaPacketHtml({ customerFirstName, contractNumber, customerPortalUrl }: Args): string {
  const greeting = customerFirstName ? `Hi ${escapeHtml(customerFirstName)},` : "Hi there,";
  return `
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>HOA Approval — Atlas Spas</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#010F21;padding:24px 28px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">ATLAS SPAS · HOA APPROVAL PACKET</h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">
            Contract <strong style="color:#ffffff;">${escapeHtml(contractNumber)}</strong>
          </p>
        </td></tr>
        <tr><td style="height:3px;background:#00929C;"></td></tr>

        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:14px;line-height:1.55;">${greeting}</p>
          <p style="margin:0 0 12px;color:#0f172a;font-size:14px;line-height:1.55;">
            Thanks for choosing Atlas Spas. Because your installation is contingent on your
            HOA's approval, we've attached our <strong>Fair Housing Legal Compliance Memorandum</strong>
            for you to use when submitting your request.
          </p>
          <p style="margin:0 0 12px;color:#0f172a;font-size:14px;line-height:1.55;">
            Submit it to your HOA along with their standard architectural request form. The
            memorandum lays out the legal framework that supports homeowners' rights to install
            spas/hot tubs and addresses the most common HOA pushback points.
          </p>
          <p style="margin:0 0 16px;color:#0f172a;font-size:14px;line-height:1.55;">
            Once your HOA approves, let us know and we'll proceed with scheduling your delivery.
          </p>

          <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;">What's attached:</p>
          <ul style="margin:0 0 16px 20px;color:#475569;font-size:13px;line-height:1.6;padding:0;">
            <li>Fair Housing Legal Compliance Memorandum (PDF)</li>
          </ul>

          <p style="margin:16px 0 8px;color:#0f172a;font-size:13px;">
            You can also access this packet anytime from your customer portal:
          </p>
          <a href="${customerPortalUrl}" style="display:inline-block;background:#00929C;color:#ffffff;font-weight:700;font-size:13px;padding:10px 18px;border-radius:6px;text-decoration:none;">View Your Customer Portal →</a>

          <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.55;">
            Questions? Reply to this email or call us at the number on file. We're happy to help
            walk through the HOA approval process with you.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:14px 28px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            Atlas Spas &amp; Swim Spas · Auto-sent because your contract ${escapeHtml(contractNumber)} requires HOA approval.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
