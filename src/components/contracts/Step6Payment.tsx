"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, generateContractNumber } from "@/lib/utils";

type PaymentState = "pending" | "processing" | "success" | "error";

export default function Step6Payment() {
  const router = useRouter();
  const { draft, resetDraft } = useContractStore();

  const [paymentState, setPaymentState] = useState<PaymentState>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ACH/Check fields
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");

  const contractNumber = generateContractNumber();
  const customerName = draft.customer
    ? `${draft.customer.first_name} ${draft.customer.last_name}`
    : "Customer";
  const customerEmail = draft.customer?.email ?? "";
  const paymentMethod = draft.payment_method ?? "";
  const depositAmount = draft.deposit_amount;
  const surchargeAmount =
    (paymentMethod === "credit_card" && draft.surcharge_enabled)
      ? draft.surcharge_amount
      : 0;
  const totalToCharge = depositAmount + surchargeAmount;
  const remainingBalance = Math.max(0, draft.total - depositAmount);

  const handleChargeCard = async () => {
    setPaymentState("processing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: draft.show_id, // will be replaced with actual contract ID
          amount: depositAmount,
          surcharge_amount: surchargeAmount,
          method: paymentMethod,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Payment failed (${response.status})`);
      }

      setPaymentState("success");
    } catch (err: any) {
      setPaymentState("error");
      setErrorMessage(err.message ?? "Payment failed. Please try again.");
    }
  };

  const handleRecordManual = async () => {
    setPaymentState("processing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/payments/record-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: draft.show_id,
          amount: depositAmount,
          method: paymentMethod,
          check_number: checkNumber || undefined,
          bank_name: bankName || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Recording failed (${response.status})`);
      }

      setPaymentState("success");
    } catch (err: any) {
      setPaymentState("error");
      setErrorMessage(err.message ?? "Failed to record payment. Please try again.");
    }
  };

  const handleNewContract = () => {
    resetDraft();
    router.push("/contracts/new");
  };

  // ── Success Screen ──────────────────────────────────────
  if (paymentState === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-12 px-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-emerald-700">
            Deposit Collected!
          </h2>
          <p className="text-slate-500 mt-2 text-lg">
            Everything is confirmed and saved
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardContent className="py-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Contract #</span>
                <span className="font-semibold">{contractNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Charged</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(totalToCharge)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="text-slate-500">Remaining Balance</span>
                <span className="font-semibold">
                  {formatCurrency(remainingBalance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/contracts")}
          >
            View Contract
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleNewContract}
          >
            New Contract
          </Button>
        </div>
      </div>
    );
  }

  // ── Main Payment Screen ─────────────────────────────────
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Success Indicator ────────────────────────────── */}
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-emerald-700">
          Contract Signed!
        </h2>
        <Badge variant="success" className="mt-2 text-sm px-3 py-1">
          {contractNumber}
        </Badge>
      </div>

      {/* ── Email Confirmation ───────────────────────────── */}
      {customerEmail && (
        <div className="text-center text-sm text-slate-500">
          Contract emailed to{" "}
          <span className="font-medium text-slate-700">{customerEmail}</span>
        </div>
      )}

      {/* ── Payment Summary ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-medium capitalize">
                {paymentMethod.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Deposit Amount</span>
              <span className="text-[#00929C]">
                {formatCurrency(depositAmount)}
              </span>
            </div>
            {surchargeAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">CC Surcharge</span>
                <span className="font-medium">
                  +{formatCurrency(surchargeAmount)}
                </span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between text-xl font-bold text-[#00929C]">
                <span>Total to Charge</span>
                <span>{formatCurrency(totalToCharge)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Payment Action ───────────────────────────────── */}
      {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
        <Card>
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              <p className="text-slate-600 font-medium">
                Present card to reader
              </p>

              {/* Animated card reader icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 relative">
                  <svg
                    className="w-16 h-16 text-[#00929C] animate-pulse"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                    />
                  </svg>
                </div>
              </div>

              <Button
                variant="success"
                size="xl"
                className="w-full text-lg"
                loading={paymentState === "processing"}
                onClick={handleChargeCard}
              >
                {paymentState === "processing"
                  ? "Processing..."
                  : `Charge ${formatCurrency(totalToCharge)}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {paymentMethod === "ach" && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <Input
              label="Check #"
              type="text"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Enter check number"
            />
            <Input
              label="Bank Name (optional)"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
            />
            <Button
              variant="primary"
              size="xl"
              className="w-full text-lg"
              loading={paymentState === "processing"}
              onClick={handleRecordManual}
            >
              {paymentState === "processing"
                ? "Recording..."
                : "Record Payment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {paymentMethod === "cash" && (
        <Card>
          <CardContent className="py-6 text-center">
            <Button
              variant="primary"
              size="xl"
              className="w-full text-lg"
              loading={paymentState === "processing"}
              onClick={handleRecordManual}
            >
              {paymentState === "processing"
                ? "Recording..."
                : "Record Cash Payment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Error Display ────────────────────────────────── */}
      {paymentState === "error" && errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-red-700"
            onClick={() => setPaymentState("pending")}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
