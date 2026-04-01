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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
] as const;

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
});

type CustomerFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
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
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
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
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    },
  });

  async function onSubmitNewCustomer(values: CustomerFormValues) {
    setSubmitting(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
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
        <h2 className="text-2xl font-bold text-[#00929C]">Customer</h2>
        <p className="text-base text-slate-500 mt-1">
          Search for an existing customer or create a new one.
        </p>
      </div>

      {/* Mode toggle tabs */}
      <div className="flex gap-2">
        <Button
          variant={mode === "search" ? "default" : "outline"}
          size="lg"
          onClick={() => setMode("search")}
          className="flex-1"
        >
          Search Existing
        </Button>
        <Button
          variant={mode === "new" ? "default" : "outline"}
          size="lg"
          onClick={() => setMode("new")}
          className="flex-1"
        >
          New Customer
        </Button>
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
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5">
                    {customer.email && (
                      <p className="text-sm text-slate-500">{customer.email}</p>
                    )}
                    {customer.phone && (
                      <p className="text-sm text-slate-500">{customer.phone}</p>
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
            label="Address"
            placeholder="123 Main St"
            error={errors.address?.message}
            {...register("address")}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="Austin"
              error={errors.city?.message}
              {...register("city")}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="state"
                className="text-sm font-medium text-slate-700"
              >
                State
              </label>
              <select
                id="state"
                className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
                {...register("state")}
              >
                <option value="">Select</option>
                {US_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {errors.state?.message && (
                <p className="text-xs text-red-600">{errors.state.message}</p>
              )}
            </div>
            <Input
              label="Zip"
              placeholder="78701"
              error={errors.zip?.message}
              {...register("zip")}
            />
          </div>

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
