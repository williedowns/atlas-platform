"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import type { DepositSplit } from "@/store/contractStore";
import type { Customer } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { decideShipToAddress } from "@/lib/tax/sourcingDecision";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import CustomerFileVault from "@/components/contracts/CustomerFileVault";
import ExemptionCertSignModal from "@/components/contracts/ExemptionCertSignModal";
import { SaleTimeDamageDialog } from "@/components/contracts/SaleTimeDamageDialog";
import { AddressAutocompleteFields } from "@/components/contracts/AddressAutocompleteFields";
import {
  formatCurrency,
  formatDate,
  generateContractNumber,
  calculateMinDeposit,
} from "@/lib/utils";
import { GRANITE_PRICE_TIERS } from "@/lib/granite";
import { MARKETING_CHANNELS } from "@/lib/marketing-feedback";

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "ach", label: "ACH" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
] as const;

interface Step5ReviewProps {
  onNext: () => void;
}

// Resize an image File to a max dimension and re-encode as a JPEG data URL.
// Keeps the staged tax-cert under localStorage limits (zustand persist) when
// the rep snaps a 4032x3024 iPhone photo. Falls back to the original via
// FileReader if anything throws (canvas blocked, weird MIME, etc).
function downscaleImageToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback to the original encoding so we still capture something
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(reader.result as string);
        }
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function Step5Review({ onNext }: Step5ReviewProps) {
  const router = useRouter();
  const { draft, setCustomer, setTax, addDepositSplit, removeDepositSplit, updateLineItemSerial, updateLineItemPrice, removeLineItem, setNotes, setExternalNotes, setMarketingFeedback, setNeedsPermit, setNeedsHoa, setPermitJurisdiction, setTaxExempt, setDocFeeWaived, setTaxExemptCert, setRxFile, setRxVerification, setConcreteEstimatePending, setConcreteEstimateNotes, markLineItemAsBlem } = useContractStore();

  // Sale-time damage capture state — when a line item index is set, the
  // SaleTimeDamageDialog opens for that line. On confirm we flip the line
  // to a blem AS-IS sale via the store. Mirrors the picker's flow so reps
  // get a second chance to flag damage at the review step if they missed
  // it during initial unit selection.
  const [damageLineIdx, setDamageLineIdx] = useState<number | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [rxError, setRxError] = useState<string | null>(null);
  // Ephemeral "AI is checking the Rx right now" flag. The verdict itself lives
  // in the store (rx_verified / rx_override / rx_verify_reason / rx_doc_type)
  // because it gates tax zeroing in computeTotals.
  const [rxVerifying, setRxVerifying] = useState(false);
  const [showExemptionSignModal, setShowExemptionSignModal] = useState(false);

  // Inline customer editing on the review step. Reps previously could not fix
  // customer info (email/phone/address) mid-quote — only after the contract was
  // submitted. Writes straight to the customers row via the browser client
  // (no contract exists yet), then refreshes the draft via setCustomer.
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    first_name: "",
    last_name: "",
    co_buyer_first_name: "",
    co_buyer_last_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  function beginEditCustomer() {
    const c = draft.customer;
    if (!c) return;
    setCustomerForm({
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      co_buyer_first_name: c.co_buyer_first_name ?? "",
      co_buyer_last_name: c.co_buyer_last_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      secondary_phone: c.secondary_phone ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
    });
    setCustomerError(null);
    setEditingCustomer(true);
  }

  function cancelEditCustomer() {
    setEditingCustomer(false);
    setCustomerError(null);
  }

  function updateCustomerField(key: keyof typeof customerForm, value: string) {
    setCustomerForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveCustomer() {
    const c = draft.customer;
    if (!c) return;
    // Guard the four required columns so a rep can't accidentally blank them.
    if (
      !customerForm.first_name.trim() ||
      !customerForm.last_name.trim() ||
      !customerForm.email.trim() ||
      !customerForm.phone.trim()
    ) {
      setCustomerError("First name, last name, email, and phone are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email.trim())) {
      setCustomerError("Enter a valid email address.");
      return;
    }
    setCustomerError(null);
    setSavingCustomer(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .update({
          first_name: customerForm.first_name.trim(),
          last_name: customerForm.last_name.trim(),
          co_buyer_first_name: customerForm.co_buyer_first_name.trim() || null,
          co_buyer_last_name: customerForm.co_buyer_last_name.trim() || null,
          email: customerForm.email.trim(),
          phone: customerForm.phone.trim(),
          secondary_phone: customerForm.secondary_phone.trim() || null,
          address: customerForm.address.trim(),
          city: customerForm.city.trim(),
          state: customerForm.state.trim(),
          zip: customerForm.zip.trim(),
        })
        .eq("id", c.id)
        .select("*")
        .single();
      if (error || !data) {
        setCustomerError(error?.message ?? "Could not save customer info. Please try again.");
        return;
      }
      const updated = data as Customer;
      // Tax is sourced from the customer's address (cross-state sourcing — see
      // Step3Products.calculateTax). Step 5 has no tax re-fetch of its own, so
      // an address change here would otherwise leave tax_rate/tax_amount stale
      // and the displayed total wrong. Detect the change against the pre-edit
      // row, then recompute after refreshing the draft.
      const addressChanged =
        (c.address ?? "") !== (updated.address ?? "") ||
        (c.city ?? "") !== (updated.city ?? "") ||
        (c.state ?? "") !== (updated.state ?? "") ||
        (c.zip ?? "") !== (updated.zip ?? "");
      setCustomer(updated);
      setEditingCustomer(false);
      if (addressChanged && draft.line_items.length > 0) {
        await refreshTaxForCustomer(updated);
      }
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : "Could not save customer info.");
    } finally {
      setSavingCustomer(false);
    }
  }

  // Mirror of Step3Products.calculateTax for the Step-5 address-edit path.
  // Re-queries /api/tax with the corrected address (incl. cross-state sourcing
  // + audit-field capture for migration 098) so a mid-review address fix can't
  // leave the tax figure stale. Failures are non-fatal: the save already
  // succeeded; the existing rate stands and Step 3 can recompute on back-nav.
  async function refreshTaxForCustomer(customer: Customer) {
    try {
      const shipTo = decideShipToAddress({
        customer,
        show: draft.show ?? null,
        location: draft.location ?? null,
      });
      const response = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: draft.line_items,
          discounts: draft.discounts,
          show_id: draft.show_id,
          location_id: draft.location_id,
          ship_to_address: shipTo,
          customer_state: customer.state ?? null,
          customer_address: customer.address ?? null,
          customer_city: customer.city ?? null,
          customer_zip: customer.zip ?? null,
        }),
      });
      if (!response.ok) return;
      const result = await response.json();
      const hasAudit =
        typeof result.tax_rate_source === "string" ||
        Array.isArray(result.tax_rate_jurisdictions);
      if (hasAudit) {
        setTax(result.total_tax ?? 0, result.tax_rate ?? 0, {
          source: typeof result.tax_rate_source === "string" ? result.tax_rate_source : null,
          effective_date:
            typeof result.tax_rate_effective_date === "string"
              ? result.tax_rate_effective_date
              : null,
          jurisdictions: Array.isArray(result.tax_rate_jurisdictions)
            ? result.tax_rate_jurisdictions
            : null,
        });
      } else {
        setTax(result.total_tax ?? 0, result.tax_rate ?? 0);
      }
    } catch (err) {
      console.error("[tax] recompute after customer edit failed:", err);
    }
  }

  // Texas contracts MUST collect an exemption certificate (Form 01-339) on
  // every sale — no exceptions (Willie 2026-06-01). tax_exempt is forced on
  // for any TX contract and cannot be turned off; signing the cert is then
  // mandatory before the rep can advance past this step. Tax still only
  // zeroes when an Rx is also on file (the Rx gate is unchanged).
  const isTexas =
    ((draft.location?.state ?? "").toUpperCase() === "TX") ||
    ((draft.show?.state ?? "").toUpperCase() === "TX") ||
    ((draft.customer?.state ?? "").toUpperCase() === "TX");
  useEffect(() => {
    if (isTexas && !draft.tax_exempt) {
      setTaxExempt(true);
    }
  }, [isTexas, draft.tax_exempt, setTaxExempt]);

  function handleClearCert() {
    setTaxExemptCert(null);
    setCertError(null);
  }

  // Capture the customer's hydrotherapy Rx — stage as a data URL in the draft
  // and let Step 7 upload to customers.prescription_url once the contract is
  // committed. Image is downscaled to keep the data URL under localStorage
  // limits. Right after staging, the file is sent to /api/rx/verify so Claude
  // can confirm it's actually a prescription before it's allowed to zero tax.
  async function handleRxFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRxError(null);
    if (file.size > 10 * 1024 * 1024) {
      setRxError("File too large — max 10MB.");
      e.target.value = "";
      return;
    }
    try {
      const isImage = file.type.startsWith("image/");
      let dataUrl: string;
      if (isImage) {
        dataUrl = await downscaleImageToDataUrl(file, 1600, 0.85);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsDataURL(file);
        });
      }
      const filename = file.name || (isImage ? "rx.jpg" : "rx.pdf");
      const mime = file.type || (isImage ? "image/jpeg" : "application/pdf");
      // Stage first so the file shows immediately (setRxFile resets the
      // verification flags → tax is NOT zeroed yet), then run AI verification.
      setRxFile({ dataUrl, filename, mime });
      await runRxVerification(dataUrl, filename, mime);
    } catch (err: any) {
      setRxError(err?.message ?? "Could not read file. Please try again.");
    } finally {
      e.target.value = "";
    }
  }

  // Send the staged Rx to the AI verifier and record the verdict in the store.
  // The verdict gates tax zeroing: only a verified prescription (or an explicit
  // override) flips rxOnFile. When the feature isn't configured server-side
  // (no API key → ranAi=false), fall back to legacy behavior and count the Rx.
  async function runRxVerification(dataUrl: string, filename: string, mime: string) {
    setRxVerifying(true);
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const fd = new FormData();
      fd.append("file", new File([blob], filename, { type: mime }));
      const res = await fetch("/api/rx/verify", { method: "POST", body: fd });
      const result = await res.json().catch(() => null);

      if (!res.ok || !result) {
        // Endpoint/auth error — treat as unverified so tax stays; the override
        // path remains available to the salesperson.
        setRxVerification({
          verified: false,
          reason: result?.error ?? "Couldn't verify the document. You can override.",
        });
        return;
      }

      if (!result.ranAi) {
        // Feature inactive server-side (no API key). Legacy behavior: count the
        // Rx as on-file so tax exempts exactly as it did before this feature.
        setRxVerification({ verified: true, reason: "" });
        return;
      }

      setRxVerification({
        verified: !!result.verified,
        reason: result.reason,
        docType: result.documentType,
      });
    } catch {
      setRxVerification({
        verified: false,
        reason: "Couldn't verify the document. Check your connection or override.",
      });
    } finally {
      setRxVerifying(false);
    }
  }

  // Salesperson vouches for the document despite an AI rejection. Recording the
  // override flips rxOnFile (tax zeroes); Step 7 then passes override=true to
  // the upload route so the decision is written to the audit log.
  function handleOverrideRx() {
    setRxVerification({
      verified: false,
      override: true,
      reason: draft.rx_verify_reason,
      docType: draft.rx_doc_type,
    });
  }

  function handleClearRx() {
    setRxFile(null);
    setRxError(null);
    setRxVerifying(false);
  }

  const contractNumber = useMemo(() => generateContractNumber(), []);
  const today = useMemo(() => formatDate(new Date()), []);
  const suggestedDeposit = useMemo(() => calculateMinDeposit(draft.total), [draft.total]);

  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteOfflineNotice, setQuoteOfflineNotice] = useState<string | null>(null);

  async function handleSaveQuote() {
    setSavingQuote(true);
    setQuoteError(null);
    setQuoteOfflineNotice(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 202 && body?.queued) {
        setQuoteOfflineNotice("Saved offline — this quote will sync to the server when you reconnect.");
        setSavingQuote(false);
        return;
      }
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to save quote");
      }
      router.push(`/quotes/${body.quote_id}`);
    } catch (err: any) {
      setQuoteError(err.message ?? "Something went wrong");
      setSavingQuote(false);
    }
  }

  // Split builder state
  const [splitAmount, setSplitAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<string>("credit_card");
  // Check-only fields
  const [checkNumber, setCheckNumber] = useState("");
  const [checkBankName, setCheckBankName] = useState("");
  const [checkPhotoFileId, setCheckPhotoFileId] = useState<string | null>(null);
  const [checkPhotoUrl, setCheckPhotoUrl] = useState<string | null>(null);
  const [checkPhotoIsPdf, setCheckPhotoIsPdf] = useState(false);
  const [checkPhotoUploading, setCheckPhotoUploading] = useState(false);
  const [checkPhotoError, setCheckPhotoError] = useState<string | null>(null);
  // ACH-only fields (collected here for Robert/Lori; Plaid integration will replace manual entry later)
  const [achRouting, setAchRouting] = useState("");
  const [achAccount, setAchAccount] = useState("");
  const [achHolder, setAchHolder] = useState("");
  const [achBankName, setAchBankName] = useState("");

  const splits = Array.isArray(draft.deposit_splits) ? draft.deposit_splits : [];
  const totalSplits = splits.reduce((sum, s) => sum + s.amount, 0);

  // Only GreenSky/WF (deduct_from_balance !== false) reduce balance at POS
  // Foundation carries to balance and is NOT deducted here
  const financingArr = Array.isArray(draft.financing) ? draft.financing : [];
  const financedAtSale = financingArr
    .filter((f) => f.deduct_from_balance !== false)
    .reduce((sum, f) => sum + f.financed_amount, 0);
  const foundationTotal = financingArr
    .filter((f) => f.deduct_from_balance === false)
    .reduce((sum, f) => sum + f.financed_amount, 0);

  const remaining = Math.max(0, draft.total - financedAtSale - totalSplits);

  const splitAmountNum = parseFloat(splitAmount) || 0;
  // Over-collection guard: deposits + at-POS financing must not exceed total.
  // Robert hit this 04-30 — financed $21,609 + deposit $10,000 on a $19,962
  // contract; balance_due math floored at $0 and quietly hid the overage.
  const wouldOverCollect = splitAmountNum > remaining + 0.01;
  const canAddSplit = splitAmountNum > 0 && !wouldOverCollect;
  // Customer must commit something to proceed: a deposit split OR financing.
  // 100% financing (e.g., GreenSky run at POS) IS the customer's commitment — no separate deposit required.
  const hasCommitment = splits.length > 0 || financingArr.length > 0;
  // DL gate: financing requires a primary borrower DL; secondary DL also required
  // when any financing entry has a co-borrower (Willie 2026-04-29).
  const [hasPrimaryDL, setHasPrimaryDL] = useState(false);
  const [hasSecondaryDL, setHasSecondaryDL] = useState(false);
  const primaryDlRequired = financingArr.length > 0;
  const hasAnyCoBorrower = financingArr.some((f) =>
    !!(f.secondary_buyer_first_name || f.secondary_buyer_last_name || f.secondary_buyer_email)
  );
  const secondaryDlRequired = primaryDlRequired && hasAnyCoBorrower;
  const dlSatisfied =
    (!primaryDlRequired || hasPrimaryDL) &&
    (!secondaryDlRequired || hasSecondaryDL);
  // TX contracts cannot advance without a signed exemption cert staged in the
  // draft (Willie 2026-06-01 — mandatory on every Texas sale, no exceptions).
  const certSatisfied = !isTexas || !!draft.tax_exempt_cert_data_url;
  const canProceed = hasCommitment && dlSatisfied && certSatisfied;

  // Upload a captured check photo against the customer (no contract_id yet —
  // contract is created at Step 7). The bookkeeper can later filter
  // customer_files by category=deposit_check_photo and customer_id to find
  // every check photo for a given customer. Saving the file_id + signed_url
  // on the deposit split so the contract record carries the linkage too.
  async function uploadCheckPhoto(file: File) {
    if (!draft.customer?.id) {
      setCheckPhotoError("Save the customer at Step 2 before capturing a check photo.");
      return;
    }
    setCheckPhotoUploading(true);
    setCheckPhotoError(null);
    setCheckPhotoIsPdf(file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("customer_id", draft.customer.id);
      fd.append("category", "deposit_check_photo");
      const r = await fetch("/api/customer-files", { method: "POST", body: fd });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await r.json();
      setCheckPhotoFileId(data.file?.id ?? null);
      // The POST response doesn't include a signed URL — refetch to get one.
      const listR = await fetch(
        `/api/customer-files?customer_id=${draft.customer.id}&category=deposit_check_photo`
      );
      if (listR.ok) {
        const list = await listR.json();
        const fresh = (list.files ?? []).find((f: { id: string }) => f.id === data.file?.id);
        setCheckPhotoUrl(fresh?.signed_url ?? null);
      }
    } catch (err) {
      setCheckPhotoError((err as Error).message ?? "Upload failed");
    } finally {
      setCheckPhotoUploading(false);
    }
  }

  async function handleCheckFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file twice still fires onChange
    if (!f) return;
    await uploadCheckPhoto(f);
  }

  function handleAddSplit() {
    if (!canAddSplit) return;
    const split: DepositSplit = {
      amount: splitAmountNum,
      method: splitMethod,
      ...(splitMethod === "check" && checkNumber ? { check_number: checkNumber } : {}),
      ...(splitMethod === "check" && checkBankName ? { bank_name: checkBankName } : {}),
      ...(splitMethod === "check" && checkPhotoFileId ? { check_photo_file_id: checkPhotoFileId } : {}),
      ...(splitMethod === "check" && checkPhotoUrl ? { check_photo_signed_url: checkPhotoUrl } : {}),
      ...(splitMethod === "ach" && achRouting ? { ach_routing_number: achRouting } : {}),
      ...(splitMethod === "ach" && achAccount ? { ach_account_number: achAccount } : {}),
      ...(splitMethod === "ach" && achHolder ? { ach_account_holder_name: achHolder } : {}),
      ...(splitMethod === "ach" && achBankName ? { ach_bank_name: achBankName } : {}),
    };
    addDepositSplit(split);
    setSplitAmount("");
    setCheckNumber("");
    setCheckBankName("");
    setCheckPhotoFileId(null);
    setCheckPhotoUrl(null);
    setCheckPhotoIsPdf(false);
    setCheckPhotoError(null);
    setAchRouting("");
    setAchAccount("");
    setAchHolder("");
    setAchBankName("");
  }

  const methodLabel = (method: string) =>
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method.replace(/_/g, " ");

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Step label ─────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 5 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Review &amp; Quote</h2>
        <p className="text-sm text-slate-500 mt-1">
          Double-check every line. You can save as a quote or continue to signature.
        </p>
      </div>

      {/* ── Contract header card ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Contract Review</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Review all details before collecting signature
              </p>
            </div>
            <Badge variant="accent" className="text-sm px-3 py-1">
              {contractNumber}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Date</span>
              <p className="font-medium">{today}</p>
            </div>
            <div>
              <span className="text-slate-500">Show</span>
              <p className="font-medium">{draft.show?.name ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-slate-500">Location</span>
              <p className="font-medium">{draft.location?.name ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-slate-500">Sales Rep</span>
              <p className="font-medium">Current User</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Customer ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Customer</CardTitle>
            {draft.customer && !editingCustomer ? (
              <Button type="button" variant="outline" size="sm" onClick={beginEditCustomer}>
                Edit
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!draft.customer ? (
            <p className="text-sm text-slate-400">No customer selected</p>
          ) : !editingCustomer ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Name</span>
                <p className="font-medium">
                  {draft.customer.first_name} {draft.customer.last_name}
                  {draft.customer.co_buyer_first_name || draft.customer.co_buyer_last_name ? (
                    <>
                      {" & "}
                      {[draft.customer.co_buyer_first_name, draft.customer.co_buyer_last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Email</span>
                <p className="font-medium">{draft.customer.email}</p>
              </div>
              <div>
                <span className="text-slate-500">Phone</span>
                <p className="font-medium">
                  {draft.customer.phone}
                  {draft.customer.secondary_phone ? ` · ${draft.customer.secondary_phone}` : ""}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Address</span>
                <p className="font-medium">
                  {draft.customer.address}, {draft.customer.city},{" "}
                  {draft.customer.state} {draft.customer.zip}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">First name</span>
                  <Input
                    className="mt-1"
                    value={customerForm.first_name}
                    onChange={(e) => updateCustomerField("first_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Last name</span>
                  <Input
                    className="mt-1"
                    value={customerForm.last_name}
                    onChange={(e) => updateCustomerField("last_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Co-buyer first name</span>
                  <Input
                    className="mt-1"
                    placeholder="optional"
                    value={customerForm.co_buyer_first_name}
                    onChange={(e) => updateCustomerField("co_buyer_first_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Co-buyer last name</span>
                  <Input
                    className="mt-1"
                    placeholder="optional"
                    value={customerForm.co_buyer_last_name}
                    onChange={(e) => updateCustomerField("co_buyer_last_name", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Email</span>
                  <Input
                    className="mt-1"
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => updateCustomerField("email", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Phone</span>
                  <Input
                    className="mt-1"
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => updateCustomerField("phone", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Secondary phone</span>
                  <Input
                    className="mt-1"
                    type="tel"
                    placeholder="optional"
                    value={customerForm.secondary_phone}
                    onChange={(e) => updateCustomerField("secondary_phone", e.target.value)}
                  />
                </label>
                <AddressAutocompleteFields
                  variant="compact"
                  values={{
                    address: customerForm.address,
                    city: customerForm.city,
                    state: customerForm.state,
                    zip: customerForm.zip,
                  }}
                  onChange={(next) => setCustomerForm((prev) => ({ ...prev, ...next }))}
                />
              </div>
              {customerError ? (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {customerError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={saveCustomer}
                  disabled={savingCustomer}
                  className="flex-1"
                >
                  {savingCustomer ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancelEditCustomer}
                  disabled={savingCustomer}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Line Items ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Serial #</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">MSRP</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Sell Price</th>
                </tr>
              </thead>
              <tbody>
                {draft.line_items.map((item, idx) => {
                  const isGranite = item.linked_spa_product_id !== undefined;
                  // "+ Report new damage" appears on any spa line that
                  // isn't already blem. unit_type is set (to stock /
                  // factory_build / floor_model / wet_model) on every
                  // spa line — accessories (delivery, chemical kit,
                  // cover) leave it undefined, so they're filtered out
                  // automatically without needing a category lookup.
                  // Including factory_build means a unit that arrives
                  // damaged from the factory can still be flagged here.
                  const canReportDamage =
                    !isGranite &&
                    !!item.unit_type &&
                    item.unit_type !== "blem";
                  return (
                  <Fragment key={idx}>
                  <tr className={canReportDamage ? "border-b-0" : "border-b border-slate-100"}>
                    <td className="py-3 px-4 font-medium">
                      {isGranite ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{item.product_name}</span>
                          <span className="text-xs font-normal text-slate-500">{item.quantity} ft @</span>
                          <select
                            value={item.sell_price}
                            onChange={(e) => updateLineItemPrice(idx, parseFloat(e.target.value))}
                            className="h-7 px-1.5 rounded border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00929C] touch-manipulation"
                            aria-label="Granite price per foot"
                          >
                            {GRANITE_PRICE_TIERS.map((p) => (
                              <option key={p} value={p}>${p}/ft</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-red-400 hover:bg-red-50 hover:text-red-500 touch-manipulation"
                            aria-label="Remove crushed granite base"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.product_name}</span>
                          {item.unit_type === "blem" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-red-100 text-red-700 border border-red-300">
                              Blem · As-Is
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      {isGranite ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <input
                          type="text"
                          value={item.serial_number ?? ""}
                          onChange={(e) => updateLineItemSerial(idx, e.target.value)}
                          placeholder="Enter serial #"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00929C] touch-manipulation"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {formatCurrency(item.msrp * item.quantity)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(item.sell_price * item.quantity)}
                    </td>
                  </tr>
                  {canReportDamage && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={4} className="px-4 pb-3">
                        <button
                          type="button"
                          onClick={() => setDamageLineIdx(idx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors touch-manipulation"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                          </svg>
                          + Report new damage on this unit
                        </button>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Blem (As-Is) Items ─────────────────────────────── */}
      {/* Surfaces every line item with unit_type='blem' so the customer can
          re-review the photos and damage description at the review step,
          before Step 7 captures the dedicated blem-acknowledgment initial.
          "Show again" reopens the kioskMode confirmation dialog if they
          want a second look — useful when the customer has been talking to
          the spouse and wants confirmation. */}
      {draft.line_items.some((li) => li.unit_type === "blem") && (
        <Card className="border-2 border-red-300 bg-red-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold">!</span>
              <CardTitle className="text-lg text-red-900">Blemishes — Important</CardTitle>
            </div>
            <p className="text-xs text-red-800/80 mt-1">
              These units are being sold AS-IS with the damage shown. You will be asked to initial that you've reviewed and accepted these blemishes on the next step.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {draft.line_items.map((li, idx) => {
              if (li.unit_type !== "blem") return null;
              const photos = li.blem_photo_urls ?? [];
              return (
                <div key={`blem-${idx}-${li.blem_line_id ?? ""}`} className="rounded-xl border border-red-200 bg-white p-3">
                  <p className="text-sm font-semibold text-red-900">
                    {li.product_name}
                    {li.serial_number ? <span className="text-xs text-slate-500 font-normal"> · Serial {li.serial_number}</span> : null}
                  </p>
                  {li.blem_description && (
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                      {li.blem_description}
                    </p>
                  )}
                  {photos.length > 0 ? (
                    <ul className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {photos.slice(0, 8).map((url, i) => (
                        <li key={url + i}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Blem ${i + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border border-red-200"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic text-red-700 mt-2">No photos attached.</p>
                  )}
                  {photos.length > 8 && (
                    <p className="text-[11px] text-red-700 mt-1.5">
                      + {photos.length - 8} more photo{photos.length - 8 === 1 ? "" : "s"} (visible on the full contract).
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Concrete Pad Estimate ──────────────────────────── */}
      {/* Concrete pad is NOT priced at the show — Alex estimates it after a
          site check. Toggle just flags the contract for follow-up; no line
          item, no tax, no money collected. */}
      <Card className={`border-2 transition-all ${draft.concrete_estimate_pending ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Concrete Pad Estimate</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <button
            type="button"
            onClick={() => setConcreteEstimatePending(!draft.concrete_estimate_pending)}
            className="flex items-center gap-4 w-full text-left touch-manipulation"
          >
            <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
              draft.concrete_estimate_pending ? "bg-amber-500 justify-end" : "bg-slate-200 justify-start"
            }`}>
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Concrete pad estimate pending</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {draft.concrete_estimate_pending
                  ? "Flagged for site check. Estimate priced and billed separately after the show."
                  : "Toggle on if customer wants a concrete pad instead of crushed granite"}
              </p>
            </div>
          </button>

          {draft.concrete_estimate_pending && (
            <div className="rounded-xl bg-white border border-amber-200 p-3">
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Notes <span className="text-xs font-normal text-slate-500">(rough sq ft, site specifics, customer expectations)</span>
              </label>
              <textarea
                value={draft.concrete_estimate_notes ?? ""}
                onChange={(e) => setConcreteEstimateNotes(e.target.value)}
                placeholder="e.g. ~80 sq ft, existing patio needs extension on east side, customer wants stamped finish"
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent touch-manipulation resize-none"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Discounts ──────────────────────────────────────── */}
      {draft.discounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {draft.discounts.map((discount, idx) => (
                <div key={idx} className="flex justify-between py-2 text-sm">
                  <span>{discount.label}</span>
                  <span className="text-red-600 font-medium">
                    -{formatCurrency(discount.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Financing ──────────────────────────────────────── */}
      {draft.financing.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Financing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.financing.map((entry, i) => (
              <div key={i} className={`text-sm ${i > 0 ? "border-t border-slate-100 pt-3" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{entry.financer_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Plan {entry.plan_number}
                      {entry.approval_number ? ` · Approval: ${entry.approval_number}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatCurrency(entry.financed_amount)}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-3 flex justify-between text-sm font-semibold">
              <span className="text-slate-600">Total Financed</span>
              <span>{formatCurrency(draft.financing.reduce((s, f) => s + f.financed_amount, 0))}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Texas Tax Exemption Certificate (mandatory on TX) ─ */}
      {(() => {
        if (!isTexas) return null;
        const rxOnFile =
          !!draft.customer?.has_prescription ||
          (!!draft.rx_data_url && (!!draft.rx_verified || !!draft.rx_override));
        const isEffectivelyExempt = !!draft.tax_exempt && rxOnFile;
        const rxStaged = !!draft.rx_data_url;
        const rxVerified = !!draft.rx_verified;
        const rxOverride = !!draft.rx_override;
        // Staged, finished verifying, and neither verified nor overridden → the
        // AI rejected it (or verification failed). Tax stays; override offered.
        const rxRejected = rxStaged && !rxVerifying && !rxVerified && !rxOverride;
        return (
          <Card className={`border-2 transition-all ${draft.tax_exempt ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-4 w-full text-left">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">
                    Texas Tax Exemption Certificate <span className="text-red-600">*</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEffectivelyExempt
                      ? "Cert + Rx on file — tax zeroed out."
                      : "Required on every Texas contract. Sign Form 01-339 below to continue."}
                  </p>
                </div>
              </div>

              {/* Cert capture. The signed 01-339 is staged in the persisted
                  draft and uploaded to /api/portal/upload-cert in Step 7 after
                  the contract row is created. */}
              {draft.tax_exempt && (
                <div className="rounded-xl bg-white border border-emerald-200 p-3">
                  {draft.tax_exempt_cert_data_url ? (
                    <div className="flex items-center gap-3">
                      {draft.tax_exempt_cert_mime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.tax_exempt_cert_data_url}
                          alt="Tax exemption certificate"
                          className="h-16 w-24 object-cover rounded border border-slate-200"
                        />
                      ) : (
                        <div className="h-16 w-24 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-800 truncate">
                          ✓ Certificate signed
                        </p>
                        {draft.tax_exempt_cert_filename && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {draft.tax_exempt_cert_filename}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Will upload when contract is signed.
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowExemptionSignModal(true)}
                          className="text-xs font-semibold text-[#00929C] hover:underline cursor-pointer text-left"
                        >
                          Re-sign
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCert}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600 text-left"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        Sign certificate (Form 01-339) — required
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowExemptionSignModal(true)}
                        className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-[#00939B] bg-[#00939B] text-white text-xs font-semibold hover:bg-[#007e85] touch-manipulation mb-2"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Sign Form 01-339 Now
                      </button>
                      <p className="text-[11px] text-slate-500 px-1">
                        Generates the Texas form with Atlas info prefilled and captures
                        the customer signature on this iPad. Required before continuing.
                      </p>
                    </>
                  )}
                  {certError && (
                    <p className="mt-2 text-xs text-red-700">{certError}</p>
                  )}
                </div>
              )}

              {/* ── Rx (prescription) ──────────────────────────────── */}
              {draft.tax_exempt && (
                <div className={`rounded-xl border p-3 ${
                  rxOnFile ? "bg-white border-emerald-200" : "bg-amber-50 border-amber-200"
                }`}>
                  {draft.customer?.has_prescription && !draft.rx_data_url ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        Rx
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-800">
                          ✓ Rx on file from a prior purchase
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Tax is zeroed automatically. Upload a new Rx if the doctor's
                          prescription has changed.
                        </p>
                      </div>
                      <label className="text-xs font-semibold text-[#00929C] hover:underline cursor-pointer flex-shrink-0">
                        Replace
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleRxFile}
                        />
                      </label>
                    </div>
                  ) : draft.rx_data_url ? (
                    <>
                    <div className="flex items-center gap-3">
                      {draft.rx_mime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.rx_data_url}
                          alt="Prescription"
                          className="h-16 w-24 object-cover rounded border border-slate-200"
                        />
                      ) : (
                        <div className="h-16 w-24 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {rxVerifying ? (
                          <p className="text-xs font-semibold text-slate-600 truncate flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Verifying prescription…
                          </p>
                        ) : rxVerified ? (
                          <p className="text-xs font-semibold text-emerald-800 truncate">
                            ✓ Rx verified — tax zeroed
                          </p>
                        ) : rxOverride ? (
                          <p className="text-xs font-semibold text-amber-800 truncate">
                            ⚠ Override applied — tax zeroed
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-red-700 truncate">
                            ✗ Not a verified prescription
                          </p>
                        )}
                        {draft.rx_filename && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {draft.rx_filename}
                          </p>
                        )}
                        {!rxVerifying && (rxVerified || rxOverride) && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Will save to customer record on contract sign.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <label className="text-xs font-semibold text-[#00929C] hover:underline cursor-pointer">
                          Replace
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleRxFile}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleClearRx}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600 text-left"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {rxRejected && (
                      <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
                        <p className="text-[11px] font-semibold text-red-800">
                          {draft.rx_verify_reason || "This doesn't look like a doctor's prescription."}
                        </p>
                        <p className="text-[11px] text-red-700 mt-1">
                          Tax will still be charged. Replace it with a valid prescription,
                          or override if you are certain this is a valid Rx.
                        </p>
                        <button
                          type="button"
                          onClick={handleOverrideRx}
                          className="mt-2 inline-flex items-center px-2.5 py-1.5 rounded-lg border border-red-400 bg-white text-red-700 text-[11px] font-semibold hover:bg-red-50 touch-manipulation"
                        >
                          Override — count as Rx anyway
                        </button>
                      </div>
                    )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        Add doctor's prescription to zero out tax
                      </p>
                      <p className="text-[11px] text-amber-800 mb-2">
                        Without an Rx on file, the cert is kept on record but tax still
                        applies. Adding the Rx flips this contract to fully tax-exempt.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-amber-500 bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer touch-manipulation">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Take Photo of Rx
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleRxFile}
                          />
                        </label>
                        <label className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-amber-500 bg-white text-amber-700 text-xs font-semibold hover:bg-amber-50 cursor-pointer touch-manipulation">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Rx File
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleRxFile}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  {rxError && (
                    <p className="mt-2 text-xs text-red-700">{rxError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Totals ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Order Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {/* Items subtotal — pull doc fee back out so the row shows just the goods */}
            {(() => {
              const docFee = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
              const itemsSubtotal = Math.max(0, draft.subtotal - docFee);
              return (
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(itemsSubtotal)}</span>
                </div>
              );
            })()}

            {draft.discount_total > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Discounts</span>
                <span className="text-red-600 font-medium">
                  -{formatCurrency(draft.discount_total)}
                </span>
              </div>
            )}

            {draft.discount_total > 0 && (() => {
              const docFee = draft.doc_fee_waived ? 0 : (draft.doc_fee_amount ?? 0);
              const itemsSubtotal = Math.max(0, draft.subtotal - docFee);
              const afterDiscount = Math.max(0, itemsSubtotal - draft.discount_total);
              return (
                <div className="flex justify-between font-semibold pt-1 border-t border-slate-100">
                  <span className="text-slate-700">Subtotal after discount</span>
                  <span className="text-slate-900">{formatCurrency(afterDiscount)}</span>
                </div>
              );
            })()}

            {(() => {
              const waivedValue = draft.line_items
                .filter((i) => i.waived)
                .reduce((sum, i) => sum + i.msrp * i.quantity, 0);
              return waivedValue > 0 ? (
                <div className="flex justify-between">
                  <span className="text-emerald-700 font-medium">Included Free</span>
                  <span className="text-emerald-700 font-medium">{formatCurrency(waivedValue)} value</span>
                </div>
              ) : null;
            })()}

            {/* Document Fee — auto-added, waivable. Amount shown is fee+tax
                combined per Willie's call (single line, no separate tax row
                below). Strikethrough applied when waived so the rep can see
                what was skipped. */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Document Fee</span>
                {/* Discrete waive control — see Step3Products. Small checkbox +
                    lowercase "w" so the customer doesn't notice it on the iPad. */}
                <button
                  type="button"
                  onClick={() => setDocFeeWaived(!draft.doc_fee_waived)}
                  title={draft.doc_fee_waived ? "Doc fee waived — tap to restore" : "Waive doc fee"}
                  aria-label={draft.doc_fee_waived ? "Doc fee waived, tap to restore" : "Waive doc fee"}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center ${
                      draft.doc_fee_waived ? "bg-slate-400 border-slate-400" : "bg-white border-slate-300"
                    }`}
                  >
                    {draft.doc_fee_waived && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[11px] lowercase text-slate-400">w</span>
                </button>
              </div>
              <span className={`font-medium ${draft.doc_fee_waived ? "line-through text-slate-400" : ""}`}>
                {formatCurrency((draft.doc_fee_amount ?? 0) + (draft.doc_fee_tax_amount ?? 0))}
              </span>
            </div>

            {/* Items tax. The "Exempt (Rx on file)" label only shows when the
                customer is ACTUALLY exempt — both tax_exempt=true AND the Rx
                is on file. tax_exempt alone is just intent; without the Rx,
                tax is still being charged (contractStore.ts effectiveItemsTax).
                Granite breakdown still requires non-exempt + tax > 0. */}
            {(() => {
              const rxOnFile =
          !!draft.customer?.has_prescription ||
          (!!draft.rx_data_url && (!!draft.rx_verified || !!draft.rx_override));
              const effectivelyExempt = draft.tax_exempt && rxOnFile;
              if (!(draft.tax_amount > 0 || effectivelyExempt)) return null;
              const graniteSubtotal = draft.line_items
                .filter((item) => item.linked_spa_product_id !== undefined)
                .reduce((sum, item) => sum + item.sell_price * item.quantity, 0);
              const showGraniteBreakdown = graniteSubtotal > 0 && !effectivelyExempt && draft.tax_amount > 0;
              if (!showGraniteBreakdown) {
                return (
                  <div className="flex justify-between">
                    <span className={effectivelyExempt ? "text-emerald-700 font-medium" : "text-slate-600"}>
                      {effectivelyExempt
                        ? `Tax (${(draft.tax_rate * 100).toFixed(2)}%) — Exempt (Rx on file)`
                        : `Tax (${(draft.tax_rate * 100).toFixed(2)}%)`}
                    </span>
                    <span className={`font-medium ${effectivelyExempt ? "text-emerald-700" : ""}`}>
                      {formatCurrency(effectivelyExempt ? 0 : draft.tax_amount)}
                    </span>
                  </div>
                );
              }
              // Subtract from tax_amount (not direct compute) so the two lines
              // always sum exactly to the existing total tax — no penny drift.
              const graniteTax = Math.round(graniteSubtotal * draft.tax_rate * 100) / 100;
              const spaTax = draft.tax_amount - graniteTax;
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax — Spa ({(draft.tax_rate * 100).toFixed(2)}%)</span>
                    <span className="font-medium">{formatCurrency(spaTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax — Granite ({(draft.tax_rate * 100).toFixed(2)}%)</span>
                    <span className="font-medium">{formatCurrency(graniteTax)}</span>
                  </div>
                </>
              );
            })()}

            <div className="border-t border-slate-200 pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold text-[#00929C]">
                <span>Total</span>
                <span>{formatCurrency(draft.total)}</span>
              </div>
              {draft.surcharge_enabled && draft.surcharge_amount > 0 && (
                <p className="text-xs text-slate-500 pt-2 leading-relaxed">
                  A {(draft.surcharge_rate * 100).toFixed(1)}% surcharge applies to any portion paid by credit card and is added at the time of payment.
                </p>
              )}
            </div>

            {remaining > 0 && (
              <div className="flex justify-between text-sm text-slate-500 pt-1">
                <span>Suggested deposit (30%)</span>
                <span>{formatCurrency(suggestedDeposit)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Deposits ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Deposits to Collect</CardTitle>
            {splits.length > 0 && (
              <span className="text-sm font-semibold text-[#00929C]">
                {formatCurrency(totalSplits)} collected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Financing deductions — GreenSky/WF only (paper contract style) */}
          {financedAtSale > 0 && (
            <div className="space-y-2">
              {financingArr
                .filter((f) => f.deduct_from_balance !== false)
                .map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#00929C]/5 border border-[#00929C]/20 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{f.financer_name}</p>
                      <p className="text-xs text-slate-500">Financed at POS — deducted from balance</p>
                    </div>
                    <span className="font-semibold text-[#00929C]">{formatCurrency(f.financed_amount)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Foundation — carries to balance notice */}
          {foundationTotal > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {financingArr.filter((f) => f.deduct_from_balance === false).map((f) => f.financer_name).join(", ")}
                </p>
                <p className="text-xs text-amber-700">Run after sale — carries to balance due</p>
              </div>
              <span className="font-semibold text-amber-700">{formatCurrency(foundationTotal)}</span>
            </div>
          )}

          {/* Added deposit splits */}
          {splits.length > 0 && (
            <div className="space-y-2">
              {splits.map((split, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {split.method === "check" && split.check_photo_signed_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        href={split.check_photo_signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <img
                          src={split.check_photo_signed_url}
                          alt="Check"
                          className="h-12 w-16 object-cover rounded border border-slate-300 hover:border-[#00929C]"
                        />
                      </a>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{formatCurrency(split.amount)}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {methodLabel(split.method)}
                        {split.method === "check" && split.check_number ? ` · Check #${split.check_number}` : ""}
                        {split.method === "check" && split.bank_name ? ` · ${split.bank_name}` : ""}
                        {split.method === "check" && split.check_photo_file_id && !split.check_photo_signed_url ? " · 📷 photo on file" : ""}
                        {split.method === "ach" && split.ach_bank_name ? ` · ${split.ach_bank_name}` : ""}
                        {split.method === "ach" && split.ach_account_number ? ` · acct ····${split.ach_account_number.slice(-4)}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDepositSplit(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Balance due at delivery */}
          {(splits.length > 0 || financedAtSale > 0) && (
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Balance due at delivery</span>
              <span className={`text-lg font-bold ${remaining === 0 ? "text-emerald-600" : "text-amber-700"}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
          )}

          {/* Already over-collected — total financing already exceeds total.
              Lock the rep out of adding more so the contract can't continue
              over-funded. They have to delete a financing or split first. */}
          {financedAtSale + totalSplits > draft.total + 0.01 && (
            <div className="rounded-lg bg-red-50 border-2 border-red-300 px-3 py-2 text-xs text-red-800">
              <p className="font-bold">
                Over-collected by {formatCurrency(financedAtSale + totalSplits - draft.total)}
              </p>
              <p className="mt-0.5">
                Total funding ({formatCurrency(financedAtSale + totalSplits)}) exceeds
                contract total ({formatCurrency(draft.total)}). Reduce financing at Step 4
                or remove a deposit split before continuing.
              </p>
            </div>
          )}

          {/* Add split form */}
          <div className="space-y-3 pt-1">
            <Input
              label={splits.length === 0 ? "Deposit Amount ($)" : "Add Another ($)"}
              type="number"
              min="0.01"
              max={remaining > 0 ? remaining.toFixed(2) : undefined}
              step="0.01"
              value={splitAmount}
              onChange={(e) => setSplitAmount(e.target.value)}
              placeholder={remaining > 0 ? remaining.toFixed(2) : "0.00"}
            />
            {wouldOverCollect && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                Over-collection blocked. Only {formatCurrency(remaining)} remaining
                to collect — the entered amount ({formatCurrency(splitAmountNum)})
                exceeds it. Reduce to {formatCurrency(remaining)} or lower.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSplitMethod(m.value)}
                  className={`h-12 rounded-full text-sm font-semibold transition-all touch-manipulation ${
                    splitMethod === m.value
                      ? "bg-[#00929C] text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {splitMethod === "check" && (
              <div className="space-y-2">
                <Input
                  label="Check # (optional)"
                  type="text"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Check number"
                />
                <Input
                  label="Bank Name (optional)"
                  type="text"
                  value={checkBankName}
                  onChange={(e) => setCheckBankName(e.target.value)}
                  placeholder="Bank name"
                />

                {/* Check photo capture — uploads to customer_files vault so the
                    bookkeeper has the routing/account/check# even if the rep
                    skipped the manual fields. */}
                <div className="rounded-lg border-2 border-dashed border-slate-300 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Photo of Check</p>
                      <p className="text-[11px] text-slate-500">Capture front of the check so the bookkeeper has routing + account on file.</p>
                    </div>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border whitespace-nowrap ${
                      checkPhotoFileId
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}>
                      {checkPhotoFileId ? "✓ Captured" : "Optional"}
                    </span>
                  </div>

                  {checkPhotoUrl ? (
                    <div className="mt-2 flex items-center gap-3">
                      {checkPhotoIsPdf ? (
                        <a
                          href={checkPhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-16 w-24 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                        >
                          PDF
                        </a>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={checkPhotoUrl}
                          alt="Check"
                          className="h-16 w-24 object-cover rounded border border-slate-200"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-[#00929C] hover:underline cursor-pointer">
                          {checkPhotoUploading ? "Uploading…" : "Retake / Replace"}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleCheckFile}
                            disabled={checkPhotoUploading}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckPhotoFileId(null);
                            setCheckPhotoUrl(null);
                            setCheckPhotoIsPdf(false);
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-[#00929C] bg-[#00929C] text-white text-xs font-semibold hover:bg-[#007279] cursor-pointer ${(checkPhotoUploading || !draft.customer?.id) ? "opacity-50 pointer-events-none" : ""}`}>
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {checkPhotoUploading ? "Uploading…" : "Take Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleCheckFile}
                          disabled={checkPhotoUploading || !draft.customer?.id}
                        />
                      </label>
                      <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-[#00929C] bg-white text-[#00929C] text-xs font-semibold hover:bg-[#00929C]/5 cursor-pointer ${(checkPhotoUploading || !draft.customer?.id) ? "opacity-50 pointer-events-none" : ""}`}>
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload File
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleCheckFile}
                          disabled={checkPhotoUploading || !draft.customer?.id}
                        />
                      </label>
                    </div>
                  )}

                  {checkPhotoError && (
                    <p className="mt-1 text-xs text-red-700">{checkPhotoError}</p>
                  )}
                  {!draft.customer?.id && (
                    <p className="mt-1 text-xs text-amber-700">Save the customer at Step 2 first.</p>
                  )}
                </div>
              </div>
            )}

            {splitMethod === "ach" && (
              <div className="space-y-2 rounded-xl border border-[#00929C]/30 bg-[#00929C]/5 p-3">
                <p className="text-xs text-slate-600">
                  Enter ACH details now to skip the back-office chase. Plaid integration will replace this once live.
                </p>
                <Input
                  label="Routing Number"
                  type="text"
                  inputMode="numeric"
                  value={achRouting}
                  onChange={(e) => setAchRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="9 digits"
                />
                <Input
                  label="Account Number"
                  type="text"
                  inputMode="numeric"
                  value={achAccount}
                  onChange={(e) => setAchAccount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Account number"
                />
                <Input
                  label="Account Holder Name"
                  type="text"
                  value={achHolder}
                  onChange={(e) => setAchHolder(e.target.value)}
                  placeholder="As printed on the check"
                />
                <Input
                  label="Bank Name"
                  type="text"
                  value={achBankName}
                  onChange={(e) => setAchBankName(e.target.value)}
                  placeholder="Bank name"
                />
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!canAddSplit}
              onClick={handleAddSplit}
            >
              + Add {splitAmount ? formatCurrency(parseFloat(splitAmount) || 0) : "Payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Notes ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">
              External Notes <span className="text-xs font-normal text-slate-500">(printed on the customer's contract & email)</span>
            </label>
            <textarea
              value={draft.external_notes ?? ""}
              onChange={(e) => setExternalNotes(e.target.value)}
              placeholder="Special instructions, agreed extras, gate code, delivery preferences..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">
              Internal Notes <span className="text-xs font-normal text-slate-500">(staff-only — never shown to the customer)</span>
            </label>
            <textarea
              value={draft.notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reminders for delivery, manager notes, accounting flags..."
              rows={3}
              className="w-full rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent touch-manipulation resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Marketing / lead attribution — INTERNAL ONLY (never on customer PDF) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            How&apos;d they find us?{" "}
            <span className="text-xs font-normal text-slate-500">(internal only — never shown to the customer)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">How they heard about the show</p>
            <div className="flex flex-wrap gap-2">
              {MARKETING_CHANNELS.map((ch) => {
                const heard = draft.marketing_feedback?.heard_about ?? [];
                const selected = heard.includes(ch.key);
                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() =>
                      setMarketingFeedback({
                        ...(draft.marketing_feedback ?? { heard_about: [] }),
                        heard_about: selected
                          ? heard.filter((k) => k !== ch.key)
                          : [...heard, ch.key],
                      })
                    }
                    className={`px-3 py-2 rounded-full border-2 text-sm font-medium transition-all touch-manipulation ${
                      selected
                        ? "border-[#00929C] bg-[#00929C] text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(draft.marketing_feedback?.heard_about ?? []).includes("other") && (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Other — please specify
              </label>
              <Input
                value={draft.marketing_feedback?.heard_about_other ?? ""}
                onChange={(e) =>
                  setMarketingFeedback({
                    ...(draft.marketing_feedback ?? { heard_about: [] }),
                    heard_about_other: e.target.value,
                  })
                }
                placeholder="e.g. saw the truck, hotel flyer..."
              />
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">
              What drew them to the booth? <span className="text-xs font-normal text-slate-500">(optional)</span>
            </label>
            <Input
              value={draft.marketing_feedback?.booth_draw ?? ""}
              onChange={(e) =>
                setMarketingFeedback({
                  ...(draft.marketing_feedback ?? { heard_about: [] }),
                  booth_draw: e.target.value,
                })
              }
              placeholder="The swim spa, a specific model, the display..."
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setMarketingFeedback({
                ...(draft.marketing_feedback ?? { heard_about: [] }),
                first_time_visitor: !draft.marketing_feedback?.first_time_visitor,
              })
            }
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all touch-manipulation ${
              draft.marketing_feedback?.first_time_visitor ? "border-[#00929C] bg-[#00929C]/10" : "border-slate-200 bg-white"
            }`}
          >
            <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
              draft.marketing_feedback?.first_time_visitor ? "bg-[#00929C] justify-end" : "bg-slate-200 justify-start"
            }`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">First time at an Atlas show</p>
              <p className="text-xs text-slate-500">Toggle on if this is their first Atlas show visit</p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* ── Contingencies (Permit / HOA) — hard-stop gates for delivery ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contingencies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <button
            type="button"
            onClick={() => setNeedsPermit(!draft.needs_permit)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all touch-manipulation ${
              draft.needs_permit ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
              draft.needs_permit ? "bg-amber-500 justify-end" : "bg-slate-200 justify-start"
            }`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Needs Permit</p>
              <p className="text-xs text-slate-500">
                {draft.needs_permit ? "Cannot deliver until permit approved" : "Toggle on if city requires a permit"}
              </p>
            </div>
          </button>
          {draft.needs_permit && (
            <Input
              label="Permit Jurisdiction (optional)"
              type="text"
              value={draft.permit_jurisdiction ?? ""}
              onChange={(e) => setPermitJurisdiction(e.target.value)}
              placeholder="City of Tyler, Smith County, etc."
            />
          )}

          <button
            type="button"
            onClick={() => setNeedsHoa(!draft.needs_hoa)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-all touch-manipulation ${
              draft.needs_hoa ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0 ${
              draft.needs_hoa ? "bg-amber-500 justify-end" : "bg-slate-200 justify-start"
            }`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Needs HOA Approval</p>
              <p className="text-xs text-slate-500">
                {draft.needs_hoa ? "Cannot deliver until HOA approves — packet will email to customer" : "Toggle on if customer's HOA requires approval"}
              </p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* ── Customer files (when financing exists, surface the vault for any other docs) ─ */}
      {primaryDlRequired && draft.customer?.id && (
        <CustomerFileVault
          customerId={draft.customer.id}
          compact
          onFilesChange={(files) => {
            setHasPrimaryDL(files.some((f) => f.category === "drivers_license"));
            setHasSecondaryDL(files.some((f) => f.category === "drivers_license_secondary"));
          }}
        />
      )}
      {primaryDlRequired && !dlSatisfied && (
        <div className="rounded-lg bg-amber-50 border-2 border-amber-300 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-amber-800">
            Driver's license required before sign:
          </p>
          {!hasPrimaryDL && (
            <p className="text-xs text-amber-700">• Primary borrower's driver's license missing.</p>
          )}
          {secondaryDlRequired && !hasSecondaryDL && (
            <p className="text-xs text-amber-700">• Co-borrower's driver's license missing.</p>
          )}
          <p className="text-xs text-amber-700 mt-1">
            Upload at Step 4 in the Borrowers section, or via the Customer Files vault above.
          </p>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────── */}
      {quoteError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{quoteError}</p>
        </div>
      )}

      {quoteOfflineNotice && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800">{quoteOfflineNotice}</p>
        </div>
      )}

      {/* Save Quote — always available once there are line items */}
      <Button
        variant="outline"
        size="xl"
        className="w-full text-lg border-[#00929C] text-[#00929C] hover:bg-[#00929C]/5"
        disabled={savingQuote || draft.line_items.length === 0}
        onClick={handleSaveQuote}
      >
        {savingQuote ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Saving Quote…
          </span>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Quote
          </>
        )}
      </Button>

      {/* Continue to Contract — requires at least one deposit */}
      <Button
        variant="accent"
        size="xl"
        className="w-full text-lg"
        disabled={!canProceed || savingQuote}
        onClick={onNext}
      >
        Sign &amp; Pay Now &rarr;
      </Button>

      {!canProceed && (
        <p className="text-center text-sm text-slate-400">
          {!hasCommitment
            ? "Add a deposit or financing to sign \u0026 pay, or save as a quote to print"
            : !certSatisfied
              ? "Sign the Texas exemption certificate (Form 01-339) above before continuing"
              : `Driver's license required before sign \u2014 upload ${secondaryDlRequired ? "primary + co-borrower DLs" : "DL"} above`}
        </p>
      )}

      {draft.customer && (
        <ExemptionCertSignModal
          isOpen={showExemptionSignModal}
          onClose={() => setShowExemptionSignModal(false)}
          customer={{
            first_name: draft.customer.first_name ?? "",
            last_name: draft.customer.last_name ?? "",
            address: draft.customer.address ?? "",
            city: draft.customer.city ?? "",
            state: draft.customer.state ?? "",
            zip: draft.customer.zip ?? "",
            phone: draft.customer.phone ?? "",
          }}
          onComplete={(cert) => {
            setTaxExemptCert(cert);
            setCertError(null);
          }}
        />
      )}

      {/* Sale-time damage capture for a line item that was added without
          damage flagged. Reuses the picker's dialog so the customer goes
          through the same Show-to-Customer photo gate; on confirm the
          line item flips to a blem AS-IS sale and Step 7 will require
          the Blem Acceptance initial pad. */}
      <SaleTimeDamageDialog
        open={damageLineIdx !== null}
        unitLabel={
          damageLineIdx !== null && draft.line_items[damageLineIdx]
            ? `${draft.line_items[damageLineIdx].product_name}${
                draft.line_items[damageLineIdx].serial_number
                  ? ` · Serial #${draft.line_items[damageLineIdx].serial_number}`
                  : ""
              }`
            : ""
        }
        onConfirm={(description, photo_urls, viewed_at) => {
          if (damageLineIdx === null) return;
          markLineItemAsBlem(damageLineIdx, { description, photo_urls, photos_viewed_at: viewed_at });
          setDamageLineIdx(null);
        }}
        onCancel={() => setDamageLineIdx(null)}
      />
    </div>
  );
}
