export interface ResetEmailData {
  reset_link: string;
  email: string;
}

const COMPANY_NAME = process.env.COMPANY_NAME ?? "Atlas Spas";

export function buildResetEmailHtml(data: ResetEmailData): string {
  const { reset_link } = data;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Figtree',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#010F21;padding:32px 40px;text-align:center;">
      <img src="https://atlasswimspas.com/logo.png" alt="${COMPANY_NAME}" style="height:48px;width:auto;" onerror="this.style.display='none'" />
      <h1 style="color:#ffffff;font-size:22px;margin:16px 0 4px;font-weight:700;">Reset Your Password</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">${COMPANY_NAME} Sales Platform</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to set a new one.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${reset_link}"
           style="display:inline-block;background:#00929C;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.01em;">
          Reset My Password →
        </a>
      </div>

      <!-- Expiry warning -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
        <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
          ⏳ <strong>This link expires in 24 hours.</strong> If it expires, request a new one from the login page.
        </p>
      </div>

      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
        If you didn't request a password reset, you can safely ignore this email. Your password won't change.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">${COMPANY_NAME}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">Sent via the ${COMPANY_NAME} Sales Platform</p>
    </div>
  </div>
</body>
</html>`;
}
