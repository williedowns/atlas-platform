export interface SigningLinkEmailData {
  customerFirstName: string;
  contractNumber: string;
  productNames: string[];
  total: number;
  signingUrl: string;
  salesRepName: string;
}

export function buildSigningLinkEmailHtml(data: SigningLinkEmailData): string {
  const {
    customerFirstName,
    contractNumber,
    productNames,
    total,
    signingUrl,
    salesRepName,
  } = data;
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const productLabel = productNames.length > 0 ? productNames.join(", ") : "your spa";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Figtree',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <div style="background:#010F21;padding:28px 32px;text-align:center;">
      <h1 style="color:#ffffff;font-size:20px;margin:0;font-weight:700;">Sign your Atlas Spas contract</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:8px 0 0;">Contract #${contractNumber}</p>
    </div>

    <div style="padding:32px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 16px;">
        Hi ${customerFirstName},
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
        ${salesRepName} from Atlas Spas finished your paperwork for ${productLabel}.
        Tap the button below to review the agreement, initial the required clauses, and add your signature
        from your phone. It takes about two minutes.
      </p>

      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Contract #</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">${contractNumber}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Total</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#00929C;font-size:14px;">${formatCurrency(total)}</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${signingUrl}"
           style="background:#00929C;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Review &amp; Sign
        </a>
      </div>

      <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;text-align:center;">
        This link expires in 7 days. If you didn't expect this email, you can ignore it.
      </p>
    </div>

    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#6b7280;margin:0;">
        Atlas Spas &amp; Swim Spas &middot; questions? Reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}
