export interface InviteEmailData {
  company_name: string;
  invitee_name: string;
  role: string;
  login_link: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  sales_rep: "Sales Rep",
  bookkeeper: "Bookkeeper",
  field_crew: "Field Crew",
};

export function buildInviteEmailHtml(data: InviteEmailData): string {
  const { company_name, invitee_name, role, login_link } = data;
  const roleLabel = ROLE_LABELS[role] ?? role.replace(/_/g, " ");
  const firstName = invitee_name.split(" ")[0] || invitee_name;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Figtree',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#010F21;padding:32px 40px;text-align:center;">
      <img src="https://atlasswimspas.com/logo.png" alt="${company_name}" style="height:48px;width:auto;" onerror="this.style.display='none'" />
      <h1 style="color:#ffffff;font-size:22px;margin:16px 0 4px;font-weight:700;">You're Invited!</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">${company_name} Sales Platform</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">
        Hi ${firstName},
      </p>
      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">
        You've been invited to join <strong>${company_name}</strong>'s sales platform as a <strong>${roleLabel}</strong>. Click the button below to set up your account — it only takes a minute.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${login_link}"
           style="display:inline-block;background:#00929C;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.01em;">
          Set Up My Account →
        </a>
      </div>

      <!-- What to expect -->
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h3 style="color:#00929C;font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">What to Expect</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="width:22px;height:22px;background:#00929C;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-top:1px;">1</span>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">Click the button above to open your account setup page</p>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="width:22px;height:22px;background:#00929C;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-top:1px;">2</span>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">Create a password for your account</p>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="width:22px;height:22px;background:#00929C;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-top:1px;">3</span>
            <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">You're in — start using the platform right away</p>
          </div>
        </div>
      </div>

      <!-- Expiry warning -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
        <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
          ⏳ <strong>This link expires in 24 hours.</strong> If it expires before you use it, ask your admin to send a new one.
        </p>
      </div>

      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
        If you weren't expecting this invitation or have questions, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">${company_name}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">Sent via the ${company_name} Sales Platform</p>
    </div>
  </div>
</body>
</html>`;
}
