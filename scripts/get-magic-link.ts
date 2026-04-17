/**
 * One-off utility: generate a direct magic/recovery link OR set a user's password.
 * Bypasses email delivery entirely.
 *
 * Usage:
 *   bun scripts/get-magic-link.ts willie@hqatlas.com
 *   bun scripts/get-magic-link.ts willie@hqatlas.com --list
 *   bun scripts/get-magic-link.ts willie@hqatlas.com --set-password='MyNewPw123!'
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      const [, k, raw] = m;
      if (process.env[k]) continue;
      process.env[k] = raw.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // no .env.local — rely on process.env
  }
}

loadEnv();

const email = process.argv[2];
const listFlag = process.argv.includes("--list");

if (!email) {
  console.error("Usage: bun scripts/get-magic-link.ts <email> [--list]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  if (listFlag) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      console.error("listUsers error:", error.message);
    } else {
      console.log(`\nAll users (${data.users.length}):`);
      for (const u of data.users) {
        console.log(`  • ${u.email ?? "(no email)"}  [role=${(u.app_metadata as any)?.role ?? "?"}, last_sign_in=${u.last_sign_in_at ?? "never"}]`);
      }
      console.log("");
    }
  }

  const setPassword = process.argv.find((a) => a.startsWith("--set-password="))?.split("=").slice(1).join("=");

  if (setPassword) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      console.error(`\n❌ No user found with email ${email}. Use --list to see all users.\n`);
      process.exit(1);
    }
    const { error: upErr } = await admin.auth.admin.updateUserById(user.id, { password: setPassword });
    if (upErr) {
      console.error(`\n❌ Failed to set password:`, upErr.message, "\n");
      process.exit(1);
    }
    console.log(`\n✅ Password set for ${email}.`);
    console.log(`   Log in at http://localhost:3000/login with that password.\n`);
    return;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email.toLowerCase().trim(),
  });

  if (error) {
    console.error(`\n❌ generateLink failed for ${email}:`);
    console.error(`   ${error.message}`);
    console.error(`\n   This usually means: the email is not in auth.users.`);
    console.error(`   Try --list to see all registered emails.\n`);
    process.exit(1);
  }

  const link = data?.properties?.action_link;
  if (!link) {
    console.error("No action_link returned. Supabase response:", data);
    process.exit(1);
  }

  console.log(`\n✅ Magic link for ${email}:\n`);
  console.log(link);
  console.log(`\n   Open this link in your browser and you'll be signed in directly.`);
  console.log(`   Once logged in, change your password at /profile.\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
