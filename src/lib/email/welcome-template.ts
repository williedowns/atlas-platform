export interface WelcomeEmailData {
  customerFirstName: string;
  customerEmail: string;
  contractNumber: string;
  contractId: string;
  productNames: string[];
  total: number;
  depositPaid: number;
  balanceDue: number;
  portalUrl: string;
  // One-click Supabase recovery link that lets the customer set a password and
  // land in the portal without a second email or a self-typed registration.
  setupLink: string;
  // Whether the signed contract PDF rode along as an attachment (copy adapts).
  contractPdfAttached?: boolean;
}

export function buildWelcomeEmailHtml(data: WelcomeEmailData): string {
  const { customerFirstName, contractNumber, contractId, productNames, total, depositPaid, balanceDue, portalUrl, setupLink, contractPdfAttached } = data;
  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Figtree',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#010F21;padding:32px 40px;text-align:center;">
      <img src="${portalUrl}/logo.png" alt="Atlas Spas & Swim Spas" style="height:48px;width:auto;" onerror="this.style.display='none'" />
      <h1 style="color:#ffffff;font-size:22px;margin:16px 0 4px;font-weight:700;">Welcome to the Atlas Family!</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">Thank you for your purchase, ${customerFirstName}</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">
        We're thrilled to welcome you to the Atlas family! Your new ${productNames.join(', ')} is on its way, and we couldn't be more excited for you to experience it.
      </p>

      <!-- Purchase Summary -->
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="color:#00929C;font-size:16px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Your Purchase Summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Contract #</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">${contractNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Product</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">${productNames.join(', ')}</td></tr>
          <tr style="border-top:1px solid #d1fae5;"><td style="padding:10px 0 6px;color:#6b7280;font-size:14px;">Total</td><td style="padding:10px 0 6px;text-align:right;font-weight:700;color:#00929C;font-size:16px;">${formatCurrency(total)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Deposit Paid</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;font-size:14px;">${formatCurrency(depositPaid)}</td></tr>
          ${balanceDue > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Balance Due at Delivery</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#d97706;font-size:14px;">${formatCurrency(balanceDue)}</td></tr>` : ''}
        </table>
      </div>

      <!-- Portal CTA -->
      <div style="background:#ffffff;border:2px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
        <h3 style="color:#111827;font-size:16px;font-weight:700;margin:0 0 8px;">Access Your Customer Portal</h3>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.5;">
          Your account is ready. Tap below to set your password — then you can pay your balance, upload your prescription (Rx) form, download your contract, and track your order anytime.
        </p>
        <a href="${setupLink}" style="display:inline-block;background:#00929C;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:14px 32px;border-radius:8px;">
          Set Password &amp; Access Portal →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;line-height:1.5;">
          ${contractPdfAttached ? 'A copy of your signed contract is attached to this email. ' : ''}You can also <a href="${portalUrl}/portal/contract/${contractId}" style="color:#00929C;">view your contract in the portal</a> at any time.
        </p>
      </div>

      <!-- Next Steps -->
      <div style="margin-bottom:24px;">
        <h3 style="color:#111827;font-size:15px;font-weight:700;margin:0 0 12px;">What Happens Next?</h3>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#00929C;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;margin-top:1px;">1</div>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;"><strong>Your order goes into production</strong> — we'll keep you updated every step of the way.</p>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#00929C;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;margin-top:1px;">2</div>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;"><strong>We'll schedule your delivery</strong> — our team will contact you to coordinate a convenient time.</p>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#00929C;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;margin-top:1px;">3</div>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;"><strong>Enjoy your new spa!</strong> — our team handles installation and gives you a full walkthrough.</p>
          </div>
        </div>
      </div>

      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        Questions? Reply to this email or call us anytime. We're here to make sure your experience is exceptional from purchase to delivery.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Atlas Spas & Swim Spas</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">5511 Hwy 31 W · Tyler, TX 75709</p>
    </div>
  </div>
</body>
</html>`;
}
