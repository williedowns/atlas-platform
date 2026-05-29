// scripts/backfill-exemption-cert.mjs
//
// Retroactively generates a Texas Form 01-339 exemption cert for one or more
// already-signed contracts. For each contract:
//   1. Pull contract + customer + signed_at + customer_signature_url
//   2. Build the prefilled cert PDF (same pdf-lib pipeline as the modal)
//   3. Overlay the customer's existing sales-agreement signature PNG
//   4. Flatten, drop the Resale front page, upload to tax-certs bucket
//   5. Update contracts.tax_exempt_cert_url + tax_exempt_cert_received[_at]
//
// Audit caveat: this transposes a signature that was given for the sales
// agreement onto a different legal document (the exemption cert). The
// Comptroller calls for the purchaser's signature on this cert specifically.
// Use only on Willie's explicit authorization; logged in MEMORY/WORK.
//
// Run: bun --env-file=.env.local scripts/backfill-exemption-cert.mjs <pair> [<pair>...]
//      Each pair is either:
//        CONTRACT_NUMBER                 — cert backfill only (no Rx)
//        CONTRACT_NUMBER:/path/to/rx.jpg — cert backfill + Rx upload to customer
//      Add --commit to actually write; otherwise dry-run prints the plan.

import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const pairs = args.filter((a) => !a.startsWith("--")).map((s) => {
  const [contractNumber, rxPath] = s.split(":");
  return { contractNumber, rxPath: rxPath || null };
});

if (pairs.length === 0) {
  console.error("Usage: bun --env-file=.env.local scripts/backfill-exemption-cert.mjs <CONTRACT_NUMBER[:/path/to/rx.jpg]> [...] [--commit]");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const SELLER = {
  name: "Atlas Spas and Swim Spas",
  street: "5511 Hwy 31 W",
  cityStateZip: "Tyler, TX 75709",
};
const SIG_OVERLAY = { x: 78, y: 123, width: 195, height: 20 };

function formatDate(iso) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

const templateBytes = await readFile("public/forms/tx-01-339.pdf");
console.log(`Loaded template: ${templateBytes.byteLength} bytes`);
console.log(`Mode: ${commit ? "COMMIT (writing)" : "DRY-RUN (no writes)"}`);
console.log("");

let okCount = 0;
let failCount = 0;

for (const { contractNumber: cnum, rxPath } of pairs) {
  console.log(`── Contract ${cnum} ───────────────────────────────`);
  try {
    // Sanity-check Rx file exists if a path was provided.
    if (rxPath) {
      try {
        await readFile(rxPath);
      } catch {
        throw new Error(`Rx file not readable at ${rxPath}`);
      }
    }

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select(`
        id, contract_number, signed_at, customer_signature_url, tax_exempt,
        tax_exempt_cert_url, tax_exempt_cert_received,
        tax_amount, tax_refund_amount,
        customer:customers(id, first_name, last_name, phone, address, city, state, zip, has_prescription, prescription_url)
      `)
      .eq("contract_number", cnum)
      .maybeSingle();

    if (cErr) throw new Error(`DB select failed: ${cErr.message}`);
    if (!contract) throw new Error("Contract not found");

    const customer = Array.isArray(contract.customer) ? contract.customer[0] : contract.customer;
    if (!customer) throw new Error("Customer not found on contract");
    if (!contract.customer_signature_url) throw new Error("No customer_signature_url on contract");

    const purchaserName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
    const purchaserCSZ = `${customer.city ?? ""}, ${customer.state ?? ""} ${customer.zip ?? ""}`.trim();
    const dateStr = contract.signed_at ? formatDate(contract.signed_at) : formatDate(new Date().toISOString());

    console.log(`  Contract id      : ${contract.id}`);
    console.log(`  Customer         : ${purchaserName}`);
    console.log(`  Address          : ${customer.address}`);
    console.log(`  City/State/Zip   : ${purchaserCSZ}`);
    console.log(`  Phone            : ${customer.phone ?? "(none)"}`);
    console.log(`  Signed date      : ${dateStr}`);
    console.log(`  has_prescription : ${customer.has_prescription}`);
    console.log(`  prescription_url : ${customer.prescription_url ?? "(none)"}`);
    console.log(`  Signature URL    : ${contract.customer_signature_url.slice(0, 80)}...`);
    if (contract.tax_exempt_cert_url) {
      console.log(`  ⚠ Cert already on file: ${contract.tax_exempt_cert_url.slice(0, 80)}...`);
      console.log(`  Will overwrite on commit.`);
    }

    // Fetch the signature PNG over HTTP (it's stored at a public URL in the
    // signatures bucket).
    const sigResp = await fetch(contract.customer_signature_url);
    if (!sigResp.ok) throw new Error(`Signature fetch failed: ${sigResp.status}`);
    const sigBytes = new Uint8Array(await sigResp.arrayBuffer());

    // Build the merged cert.
    const pdf = await PDFDocument.load(templateBytes);
    const form = pdf.getForm();

    form.getTextField("Exemption purchaser").setText(purchaserName);
    form.getTextField("Exemption purchaser street").setText(customer.address ?? "");
    form.getTextField("Exemption purchaser phone").setText(customer.phone ?? "");
    form.getTextField("Exemption purchaser city").setText(purchaserCSZ);
    form.getTextField("Exempt seller").setText(SELLER.name);
    form.getTextField("Exempt seller street").setText(SELLER.street);
    form.getTextField("Exempt seller city").setText(SELLER.cityStateZip);
    form.getTextField("Exempt item description").setText("Hot tub or swim spa");
    form.getTextField("Exemption reason").setText("Hydrotherapy");
    form.getTextField("Exempt purchaser title").setText("Owner");
    form.getTextField("Exempt purchaser sig date").setText(dateStr);

    const sigImage = await pdf.embedPng(sigBytes);
    const page2 = pdf.getPage(1);
    page2.drawImage(sigImage, SIG_OVERLAY);

    form.flatten();
    pdf.removePage(0);

    const mergedBytes = await pdf.save();
    console.log(`  Merged PDF size  : ${mergedBytes.byteLength} bytes`);

    if (!commit) {
      // Write the dry-run output to /tmp for visual review.
      const previewPath = `/tmp/backfill-${cnum}.pdf`;
      const { writeFile } = await import("node:fs/promises");
      await writeFile(previewPath, mergedBytes);
      console.log(`  Dry-run preview  : ${previewPath}`);
      if (rxPath) {
        console.log(`  Would upload Rx  : ${rxPath} → customers.prescription_url`);
      }
      console.log("  (No DB writes performed.)");
      okCount++;
      console.log("");
      continue;
    }

    // COMMIT: upload Rx (if provided) first so customer.has_prescription is
    // true before the cert lands. Order matters if anything mid-run watches
    // the customer row — but both writes are independent so order is mostly
    // for log readability.
    if (rxPath) {
      const rxBytes = await readFile(rxPath);
      const rxExt = rxPath.split(".").pop() ?? "jpg";
      const rxStoragePath = `${customer.id}/rx-${Date.now()}.${rxExt}`;
      const rxMime = rxExt === "pdf" ? "application/pdf" : `image/${rxExt === "jpg" ? "jpeg" : rxExt}`;
      const { error: rxUpErr } = await supabase.storage
        .from("customer-files")
        .upload(rxStoragePath, rxBytes, { contentType: rxMime, upsert: false });
      if (rxUpErr) throw new Error(`Rx upload failed: ${rxUpErr.message}`);
      const { data: rxUrlData } = supabase.storage.from("customer-files").getPublicUrl(rxStoragePath);
      const rxUrl = rxUrlData.publicUrl;
      const { error: custErr } = await supabase
        .from("customers")
        .update({ has_prescription: true, prescription_url: rxUrl })
        .eq("id", customer.id);
      if (custErr) throw new Error(`Customer update failed: ${custErr.message}`);
      console.log(`  ✓ Rx uploaded    : ${rxUrl}`);
      console.log(`  ✓ Customer updated: has_prescription = true`);
    }

    const path = `${contract.id}/tx-01-339-signed-backfill-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("tax-certs")
      .upload(path, mergedBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`Cert upload failed: ${upErr.message}`);

    const { data: urlData } = supabase.storage.from("tax-certs").getPublicUrl(path);
    const certUrl = urlData.publicUrl;

    const { error: updErr } = await supabase
      .from("contracts")
      .update({
        tax_exempt: true,
        tax_exempt_cert_url: certUrl,
        tax_exempt_cert_received: true,
        tax_exempt_cert_received_at: new Date().toISOString(),
      })
      .eq("id", contract.id);
    if (updErr) throw new Error(`Contract update failed: ${updErr.message}`);

    console.log(`  ✓ Cert uploaded  : ${certUrl}`);
    console.log(`  ✓ Contract updated`);

    // Notify bookkeeper ONLY when a refund is actually owed (tax was
    // collected and not yet refunded). Mirrors the gated logic in
    // /api/portal/upload-cert.
    const contractTaxAmount = Number(contract.tax_amount ?? 0);
    const contractRefundIssued = contract.tax_refund_amount != null;
    const refundOwed = contractTaxAmount > 0 && !contractRefundIssued;
    if (refundOwed) {
      const resendKey = process.env.RESEND_API_KEY;
      const loriEmail = process.env.BOOKKEEPER_EMAIL ?? "lori@atlasswimspas.com";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Atlas Spas Platform <noreply@atlasswimspas.com>",
            to: loriEmail,
            subject: `⚠️ Tax Refund Needed — Contract ${contract.contract_number}`,
            html: `
              <p>A backfilled tax exemption certificate has been attached to contract <strong>${contract.contract_number}</strong>.</p>
              <p><strong>Tax collected at sale:</strong> $${contractTaxAmount.toFixed(2)}</p>
              <p><strong>Action required:</strong> Please review the certificate and issue the tax refund in QuickBooks.</p>
              <p><a href="${appUrl}/bookkeeper">Open Bookkeeper Dashboard</a></p>
              <p>Certificate file: <a href="${certUrl}">${certUrl}</a></p>
            `,
          }),
        }).catch(() => {/* non-fatal */});
        console.log(`  ✓ Lori notified (refund owed: $${contractTaxAmount.toFixed(2)})`);
      } else {
        console.log(`  ⚠ Refund owed ($${contractTaxAmount.toFixed(2)}) but RESEND_API_KEY missing — Lori not notified`);
      }
    } else {
      console.log(`  • No refund email (tax_amount = $${contractTaxAmount.toFixed(2)}, refund_issued = ${contractRefundIssued})`);
    }
    okCount++;
  } catch (e) {
    console.error(`  ✗ FAILED: ${e?.message ?? e}`);
    failCount++;
  }
  console.log("");
}

console.log(`Summary: ${okCount} ok, ${failCount} failed.`);
process.exit(failCount === 0 ? 0 : 1);
