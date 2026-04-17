# Security & Backup Operations Guide

Assessment and recommendations based on Ian Allena (CPA) consultation, 2026-04-08.

---

## 1. Row-Level Security (RLS) Coverage

### Current State
All tables with user-facing data have RLS enabled:

| Table | RLS | Policies | Notes |
|-------|-----|----------|-------|
| `profiles` | Enabled | Read own, admin reads all | Correct |
| `contracts` | Enabled | Rep sees own, admin/manager see all | Correct |
| `customers` | Enabled | Authenticated read, rep creates | Correct |
| `payments` | Enabled | Via contract ownership | Correct |
| `locations` | Enabled | Authenticated read, admin write | Correct |
| `shows` | Enabled | Authenticated read, admin write | Correct |
| `products` | Enabled | Authenticated read, admin write | Correct |
| `equipment` | Enabled | Via customer ownership | Correct |
| `audit_logs` | Enabled | Admin/manager/bookkeeper read | Correct |
| `leads` | Enabled | Rep sees own, admin sees all | Correct |
| `qbo_tokens` | Enabled | Admin only | Correct |
| `inventory_units` | Enabled | Authenticated read, admin write | Correct |
| `service_requests` | Enabled | Customer sees own, staff sees all | Correct |

### Recommendations
- Periodically audit RLS policies when new tables are added
- Test RLS with non-admin accounts to verify isolation
- Consider adding `organization_id` scoping for future multi-tenant support

---

## 2. Supabase Backup Strategy

### Current State (Supabase Pro Plan)
- **Automatic daily backups**: Supabase Pro includes daily automated backups with 7-day retention
- **Point-in-time recovery (PITR)**: Available on Pro plan — allows restoring to any point within the retention window

### Recommendations

**Immediate Actions:**
1. **Verify PITR is enabled** in Supabase Dashboard > Settings > Database > Backups
2. **Test a restore** in a staging project to verify backups are actually recoverable
3. **Enable WAL archiving** if not already active (needed for PITR)

**Additional Safeguards:**
1. **Scheduled pg_dump exports**: Set up a weekly `pg_dump` to an external S3 bucket as a secondary backup
   - Use `supabase db dump` CLI command
   - Store in a separate AWS/GCP bucket with versioning enabled
   - Automate via cron job or GitHub Action
2. **Storage backups**: Supabase Storage (tax certificates, documents) is NOT included in database backups
   - Set up S3 bucket replication or periodic sync for the `tax-certs` bucket
3. **QBO token backup**: The `qbo_tokens` table contains critical OAuth credentials
   - If lost, you'll need to re-authorize QBO from Admin page
   - Consider documenting the re-auth process as a runbook

---

## 3. Environment Variable Security

### Current Secrets in Vercel

| Variable | Sensitivity | Notes |
|----------|------------|-------|
| `SUPABASE_URL` | Low | Public by design |
| `SUPABASE_ANON_KEY` | Low | Public, RLS-gated |
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL** | Bypasses RLS — never expose client-side |
| `QBO_CLIENT_ID` | Medium | OAuth client identifier |
| `QBO_CLIENT_SECRET` | **HIGH** | OAuth secret — can generate tokens |
| `INTUIT_MERCHANT_TOKEN` | **HIGH** | Can charge credit cards |
| `RESEND_API_KEY` | Medium | Can send emails as your domain |
| `AVALARA_ACCOUNT_ID` | Medium | Tax API identifier |
| `AVALARA_LICENSE_KEY` | **HIGH** | Tax API auth |
| `NEXT_PUBLIC_*` | Low | Exposed to browser by design |

### Hygiene Checklist
- [ ] All secrets stored in Vercel Environment Variables (not in code or `.env` files committed to git)
- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets in `NEXT_PUBLIC_*` variables (these are exposed to the browser)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is ONLY used in server-side API routes, never in client components
- [ ] Vercel preview deployments use separate/sandbox credentials where possible
- [ ] Rotate `QBO_CLIENT_SECRET` and `INTUIT_MERCHANT_TOKEN` annually
- [ ] Team members with Vercel access are audited quarterly

---

## 4. HTTPS & Authentication Security

### Current Posture
- **HTTPS**: Enforced by Vercel — all traffic is TLS 1.3
- **Authentication**: Supabase Auth with JWT tokens
  - Password-based login with email confirmation
  - Session tokens stored in httpOnly cookies (server-side Supabase client)
  - Password reset via Resend (branded email, not Supabase SMTP)
- **CORS**: Next.js API routes are same-origin by default
- **CSRF**: Protected by Vercel's same-origin cookie handling
- **Rate limiting**: In-process rate limiter on payment routes (15/min per IP)

### Recommendations
1. **Add 2FA for admin accounts**: Supabase Auth supports TOTP-based MFA
   - Priority: HIGH — admin accounts can access all data and process payments
2. **Session timeout**: Configure shorter session lifetimes for admin/bookkeeper roles
3. **IP allowlisting**: Consider restricting admin routes to known office IPs (via Vercel middleware)
4. **Webhook signatures**: If adding QBO webhooks, verify Intuit's HMAC signatures
5. **Payment PCI compliance**: Intuit Payments handles PCI — card numbers are tokenized client-side and never touch your server in plaintext. Maintain this pattern.
6. **CSP headers**: Add Content-Security-Policy headers via `next.config.js` to prevent XSS

---

## 5. Disaster Recovery Runbook

### If database is lost/corrupted:
1. Go to Supabase Dashboard > Settings > Database > Backups
2. Select the most recent backup or PITR timestamp
3. Restore to a new project for validation
4. If validated, swap DNS / environment variables to point to restored project

### If QBO connection is lost:
1. Go to Admin page in Atlas
2. Click "Connect QuickBooks" to re-authorize
3. Tokens will be stored fresh in `qbo_tokens` table

### If Avalara credentials are compromised:
1. Log into Avalara admin portal
2. Regenerate license key
3. Update `AVALARA_LICENSE_KEY` in Vercel
4. Redeploy

### If payment merchant token is compromised:
1. Contact Intuit Developer support immediately
2. Rotate the merchant token
3. Update `INTUIT_MERCHANT_TOKEN` in Vercel
4. Redeploy — no payment processing until complete
