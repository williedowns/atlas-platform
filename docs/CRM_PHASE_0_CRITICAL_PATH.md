# Salta CRM — Phase 0 Critical-Path Provisioning Checklist

**Owner:** Willie Downs
**Status:** 1 of 9 in progress (Twilio account created)
**Created:** 2026-05-01
**Last updated:** 2026-05-19

These items have **multi-week lead times** and must be kicked off in parallel with the database build (migrations 044-060). Each blocks one or more downstream phases. The CRM will not function in production without them.

The build itself does **not** depend on these — Phase 0 schema is pure SQL, and Phase 1 UI (Contacts, Pipeline, Activities timeline) can ship and be used internally without external services. But before any external customer message can be sent, before any Meta lead lands, before any AI feature ships in production, these have to be done.

---

## Critical path — start TODAY

### 1. Twilio account + 10DLC brand registration (BLOCKS ALL SMS)

**Lead time:** 2-4 weeks (carrier vetting)
**Cost:** ~$4 brand fee + $10/campaign + per-message
**Blocks:** Phase 1 (speed-to-lead SMS), Phase 2 (SMS broadcasts, cadence SMS steps)

**Steps:**
1. ✅ Sign up at twilio.com — DONE 2026-05-19 by willie@hqatlas.com
   - ⚠️ Used personal email. Recommend inviting a shared `crm@hqatlas.com` or `admin@hqatlas.com` as a secondary owner on the Twilio console so account access doesn't go with one person. Twilio console → Account → Users → Invite. Easy to do anytime.
2. ☐ Add a payment method (Twilio won't let you submit 10DLC without one on file)
3. ☐ **Submit 10DLC Brand registration via The Campaign Registry (TCR)** ← THIS IS THE LONG POLE (2-4 weeks)
   - Twilio walks you through it in the console under Messaging → Regulatory Compliance → Brand
   - Brand: Atlas Building Systems / Atlas Spas
   - EIN, business address, vertical (HOME_FURNISHINGS or RETAIL)
4. ☐ Once Brand is approved, register Campaigns:
   - Marketing — broadcasts, promos
   - Customer Care — support, status updates
   - Higher trust score (Standard or Low Volume Mixed) = higher throughput
5. ☐ Provision phone numbers per location (Plano, Tulsa, etc.) — local-presence pool
6. ☐ (Backup) Toll-free number for high-volume sends — separate verification process
7. ☐ Save Twilio Account SID + Auth Token to Vercel env vars (do NOT commit)

**Status:** ⏳ In progress — account created, 10DLC Brand registration not yet submitted (the 2-4 week long pole — do this next)

---

### 2. Email infrastructure (BLOCKS ALL MARKETING EMAIL)

**Lead time:** 1-2 weeks (DNS propagation + BIMI VMC verification)
**Cost:** ~$1,200-1,500/yr for VMC certificate (DigiCert/Entrust)
**Blocks:** Phase 2 (email campaigns, lifecycle programs, cadence email steps)

**Two-domain split:**
- `notifications.atlasspas.com` — transactional (existing Resend domain)
- `mail.atlasspas.com` — marketing (NEW, separate IP pool)

**Steps:**
1. Create `mail.atlasspas.com` subdomain in DNS
2. Resend dashboard → add domain → copy DNS records:
   - SPF (`v=spf1 include:_spf.resend.com ~all`)
   - DKIM (selector + public key)
   - DMARC (`v=DMARC1; p=reject; rua=mailto:dmarc@atlasspas.com`)
3. Apply for BIMI VMC certificate via DigiCert or Entrust
   - Requires verified trademark or registered logo
   - Atlas Spas logo SVG at `public/logo.svg` — confirm trademark status
4. Add BIMI DNS record once VMC is issued
5. Set up bounce + complaint webhook endpoints (`POST /api/webhooks/resend`)
6. Confirm Postmark fallback contract (transactional only) for redundancy
7. Implement RFC 8058 List-Unsubscribe + One-Click Unsubscribe in all marketing templates

**Status:** ☐ Not started

---

### 3. Meta Business verification + Conversions API (BLOCKS LEAD INTAKE + ATTRIBUTION)

**Lead time:** 5-10 days (Meta business verification)
**Cost:** $0 (Meta Business Suite is free)
**Blocks:** Phase 1 (Meta Lead Ads webhook), Phase 2 (CAPI server-side events, Custom Audiences)

**Steps:**
1. Confirm Meta Business Manager is set up for Atlas Spas
2. Submit business verification (D-U-N-S, articles of incorporation, etc.)
3. Create / link Facebook Page + Instagram for Atlas Spas (likely already exist)
4. Set up a Pixel (likely already exists from existing tracking)
5. Generate Conversions API access token (long-lived, server-side)
6. Test event match rate via Events Manager
7. Set up Lead Ads webhook destination — point to `POST /api/webhooks/meta/leadgen` (Phase 1)
8. Save CAPI access token to Vercel env vars

**Status:** ☐ Not started

---

### 4. Google Ads + Enhanced Conversions for Web

**Lead time:** 5-10 days
**Cost:** $0 (API is free)
**Blocks:** Phase 1 (Google Lead Form webhook), Phase 2 (Enhanced Conversions, Customer Match)

**Steps:**
1. Confirm Google Ads account + Google Tag is live
2. Enable Enhanced Conversions for Web in Conversion Settings
3. Create OAuth 2.0 credentials for Google Ads API access (Customer Match upload)
4. Verify domain in Google Ads
5. Set up Lead Form Extensions webhook destination — `POST /api/webhooks/google/leadform` (Phase 1)
6. Save Google Ads developer token + OAuth credentials to Vercel env vars

**Status:** ☐ Not started

---

### 5. Anthropic + OpenAI enterprise contracts with no-training clauses

**Lead time:** 1-3 weeks (legal review)
**Cost:** Pay-as-you-go (no commit)
**Blocks:** Phase 3 (Atlas Copilot launch in production — call summaries, draft replies, segment-from-NL, deal coaching, AI receptionist, review responses)

**Steps:**
1. Anthropic — request enterprise contract via console.anthropic.com sales contact
   - Confirm zero data retention (ZDR) is available on the plan
   - Confirm no-training-on-customer-data clause in MSA
2. OpenAI — request enterprise contract for GPT-4o + embeddings
   - Same no-training clause
   - Confirm compliance certifications (SOC 2 Type II)
3. Legal review of both MSAs
4. Save API keys to Vercel env vars under `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
5. Set monthly budget caps in each provider's dashboard

**Status:** ☐ Not started

---

### 6. OpenPhone provisioning + number ports

**Lead time:** 7-14 days (LOA processing + carrier release)
**Cost:** ~$19/seat/mo
**Blocks:** Phase 1 (call data lands in CRM), Phase 3 (AI call summaries)

**Steps:**
1. Sign up at openphone.com — Business plan minimum for API + webhook access
2. If migrating numbers from existing system: submit Letters of Authorization (LOA)
3. Provision per-rep numbers OR shared inbox per store (Plano, Tulsa)
4. Configure IVR routing
5. Enable call recording (with state-by-state consent disclosures)
6. Set up webhook endpoint — `POST /api/webhooks/openphone` (Phase 1)
7. Save OpenPhone API key to Vercel env vars

**Alternative:** Aircall (better CRM hooks but more expensive). OpenPhone recommended for MVP cost.

**Status:** ☐ Not started

---

### 7. Bland.ai or Vapi (AI receptionist)

**Lead time:** 1-2 days (account setup)
**Cost:** ~$0.09/min
**Blocks:** Phase 3 (24/7 AI receptionist for after-hours and overflow inbound calls)

**Steps:**
1. Sign up at bland.ai (or vapi.ai)
2. Create an agent — use Atlas Spas product catalog + financing options + store hours as RAG corpus
3. Configure intents: qualify, route to nearest store, book appointment, escalate to human
4. Test agent with 5-10 mock inbound calls
5. Wire as overflow destination on OpenPhone
6. Save API key to Vercel env vars

**Status:** ☐ Not started

---

### 8. Deepgram (or fall back to OpenAI Whisper)

**Lead time:** <1 day
**Cost:** ~$0.0043/min for Nova-3 model
**Blocks:** Phase 1 (call transcription pipeline)

**Steps:**
1. Sign up at deepgram.com — Pay-as-you-go is fine for Phase 0
2. Generate API key
3. Save to Vercel env vars

**Fallback:** OpenAI Whisper API (slower, more expensive at scale, but simpler).

**Status:** ☐ Not started

---

### 9. Cal.com self-host (or Google Calendar API)

**Lead time:** <1 day for self-host on existing server, OR use Google Calendar API directly
**Cost:** $0 self-host; Google Calendar API is free
**Blocks:** Phase 1 (showroom appointment booking flow)

**Decision:**
- **Self-host Cal.com** if we want full control + customer-facing branded booking pages
- **Google Calendar API only** if we want to ship faster and embed Calendly/Google booking widgets

**Recommendation:** Start with Google Calendar API in Phase 1; layer Cal.com self-host in Phase 2.

**Status:** ☐ Not started

---

## Optional / lower-priority

### Yelp Fusion API

**Lead time:** 1-2 weeks (Yelp app review)
**Blocks:** Phase 2 reviews module (Google Business Profile is the priority; Yelp + Facebook are nice-to-have)

### TikTok Events API
### Pinterest Conversions API

Both lower priority. Phase 2+ if we add the channel.

### Slack workspace + bot

For internal team alerts (deal won, escalations). Already in use likely; just need bot token + webhook URL.

---

## Tracking

When each item moves to "in progress" or "done", update the status box at the top of its section. We'll review this weekly until everything is green.

When the CRM database build (migrations 044-060) finishes, the CRM will work for internal-only use (sales reps using the Pipeline / Contacts / Activities UI). External customer-facing features unlock as each provisioning item completes.
