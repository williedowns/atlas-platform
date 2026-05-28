"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractStore } from "@/store/contractStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer } from "@/types";
import { AddressAutocompleteFields } from "./AddressAutocompleteFields";

const customerSchema = z
  .object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    // Co-buyer required by default; rep must check "single buyer" to override.
    co_buyer_first_name: z.string().optional(),
    co_buyer_last_name: z.string().optional(),
    single_buyer: z.boolean(),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone is required"),
    secondary_phone: z.string().optional(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.single_buyer) {
      if (!data.co_buyer_first_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["co_buyer_first_name"],
          message: "Co-buyer first name is required",
        });
      }
      if (!data.co_buyer_last_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["co_buyer_last_name"],
          message: "Co-buyer last name is required",
        });
      }
    }
  });

type CustomerFormValues = {
  first_name: string;
  last_name: string;
  co_buyer_first_name?: string;
  co_buyer_last_name?: string;
  single_buyer: boolean;
  email: string;
  phone: string;
  secondary_phone?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

interface Step2CustomerProps {
  onNext: () => void;
}

export default function Step2Customer({ onNext }: Step2CustomerProps) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { setCustomer } = useContractStore();

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const supabase = createClient();
    const pattern = `%${query}%`;

    const { data } = await supabase
      .from("customers")
      .select("*")
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},co_buyer_first_name.ilike.${pattern},co_buyer_last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},secondary_phone.ilike.${pattern}`
      )
      .limit(20);

    setSearchResults((data as Customer[]) ?? []);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  function handleSelectCustomer(customer: Customer) {
    setCustomer(customer);
    onNext();
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      co_buyer_first_name: "",
      co_buyer_last_name: "",
      single_buyer: false,
      email: "",
      phone: "",
      secondary_phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    },
  });

  const singleBuyer = watch("single_buyer");

  async function onSubmitNewCustomer(values: CustomerFormValues) {
    setSubmitting(true);
    setCreateError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: values.first_name,
        last_name: values.last_name,
        co_buyer_first_name: values.co_buyer_first_name?.trim() || null,
        co_buyer_last_name: values.co_buyer_last_name?.trim() || null,
        email: values.email,
        phone: values.phone,
        secondary_phone: values.secondary_phone?.trim() || null,
        address: values.address || "",
        city: values.city || "",
        state: values.state || "",
        zip: values.zip || "",
        has_prescription: false,
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error) {
      console.error("Failed to create customer:", error);
      // Surface a usable message — duplicate email is the most common cause
      // (unique index on customers.email). Otherwise show whatever Supabase
      // returned so the rep has SOMETHING to act on.
      const msg = /duplicate|unique/i.test(error.message)
        ? "A customer with this email already exists. Try Search Existing instead."
        : (error.message || "Failed to save customer. Please try again.");
      setCreateError(msg);
      return;
    }

    if (data) {
      setCustomer(data as Customer);
      onNext();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#00929C] font-bold">Step 2 of 8</p>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Who's buying?</h2>
        <p className="text-sm text-slate-500 mt-1">
          Search for an existing customer or add a new one.
        </p>
      </div>

      {/* Segmented mode toggle */}
      <div className="inline-flex rounded-xl p-1 bg-slate-100 w-full">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "search"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Search Existing
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === "new"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          New Customer
        </button>
      </div>

      {/* Search mode */}
      {mode === "search" && (
        <div className="space-y-4">
          <Input
            label="Search by name, email, or phone"
            placeholder="Start typing to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          {searching && (
            <div className="flex items-center justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-[#00929C]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          )}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-base text-slate-500">
                  No customers found. Try a different search or create a new
                  customer.
                </p>
              </CardContent>
            </Card>
          )}

          {!searching && searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-sm text-slate-400 text-center py-4">
              Type at least 2 characters to search
            </p>
          )}

          <div className="space-y-3">
            {searchResults.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer transition-all active:scale-[0.99] touch-manipulation hover:border-slate-300"
                onClick={() => handleSelectCustomer(customer)}
              >
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {customer.first_name} {customer.last_name}
                    {customer.co_buyer_first_name || customer.co_buyer_last_name ? (
                      <span className="text-slate-500 font-normal">
                        {" & "}
                        {[customer.co_buyer_first_name, customer.co_buyer_last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    ) : null}
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5">
                    {customer.email && (
                      <p className="text-sm text-slate-500">{customer.email}</p>
                    )}
                    {customer.phone && (
                      <p className="text-sm text-slate-500">{customer.phone}</p>
                    )}
                    {customer.secondary_phone && (
                      <p className="text-sm text-slate-500">{customer.secondary_phone}</p>
                    )}
                  </div>
                  {(customer.city || customer.state) && (
                    <p className="text-sm text-slate-400 mt-0.5">
                      {[customer.city, customer.state]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* New customer form */}
      {mode === "new" && (
        <form
          onSubmit={handleSubmit(onSubmitNewCustomer)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="John"
              error={errors.first_name?.message}
              {...register("first_name")}
            />
            <Input
              label="Last Name *"
              placeholder="Smith"
              error={errors.last_name?.message}
              {...register("last_name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={singleBuyer ? "Co-Buyer First Name" : "Co-Buyer First Name *"}
              placeholder={singleBuyer ? "Jane (optional)" : "Jane"}
              disabled={singleBuyer}
              error={errors.co_buyer_first_name?.message}
              {...register("co_buyer_first_name")}
            />
            <Input
              label={singleBuyer ? "Co-Buyer Last Name" : "Co-Buyer Last Name *"}
              placeholder={singleBuyer ? "Smith (optional)" : "Smith"}
              disabled={singleBuyer}
              error={errors.co_buyer_last_name?.message}
              {...register("co_buyer_last_name")}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-[#00929C] focus:ring-2 focus:ring-[#00929C] accent-[#00929C] touch-manipulation"
              {...register("single_buyer")}
            />
            <span className="text-sm text-slate-700">
              No co-buyer (single buyer only)
            </span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email *"
              type="email"
              placeholder="john@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Phone *"
              type="tel"
              placeholder="(555) 123-4567"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>

          <Input
            label="Secondary Phone"
            type="tel"
            placeholder="(555) 987-6543 (optional — co-buyer or work)"
            error={errors.secondary_phone?.message}
            {...register("secondary_phone")}
          />

          <AddressAutocompleteFields
            variant="labeled"
            values={{
              address: watch("address") || "",
              city: watch("city") || "",
              state: watch("state") || "",
              zip: watch("zip") || "",
            }}
            onChange={(next) => {
              setValue("address", next.address, { shouldValidate: true });
              setValue("city", next.city, { shouldValidate: true });
              setValue("state", next.state, { shouldValidate: true });
              setValue("zip", next.zip, { shouldValidate: true });
            }}
            errors={{
              address: errors.address?.message,
              city: errors.city?.message,
              state: errors.state?.message,
              zip: errors.zip?.message,
            }}
          />

          {createError && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">Couldn't save customer</p>
              <p className="mt-1 text-red-700">{createError}</p>
            </div>
          )}

          <div className="pt-4">
            <Button
              type="submit"
              variant="default"
              size="xl"
              className="w-full"
              loading={submitting}
            >
              Create Customer & Continue
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
