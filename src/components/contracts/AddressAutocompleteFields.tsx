"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

// Lazy-load Mapbox's AddressAutofill on the client only — the package
// touches `document` at module load, which throws during SSR even though
// this file is "use client" (Next.js still SSRs client components).
const AddressAutofill = dynamic(
  () => import("@mapbox/search-js-react").then((m) => m.AddressAutofill),
  { ssr: false },
);

export interface AddressFields {
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface AddressErrors {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Props {
  values: AddressFields;
  onChange: (next: AddressFields) => void;
  errors?: AddressErrors;
  variant?: "labeled" | "compact";
  disabled?: boolean;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
] as const;

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

function toStateCode(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Already a 2-letter code?
  if (trimmed.length === 2 && /^[A-Z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] ?? "";
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "";

interface MapboxAddressProperties {
  feature_name?: string;
  address_line1?: string;
  address_level1?: string;
  address_level2?: string;
  postcode?: string;
  country_code?: string;
}

interface RetrieveResponse {
  features: Array<{ properties: MapboxAddressProperties }>;
}

export function AddressAutocompleteFields({
  values,
  onChange,
  errors,
  variant = "labeled",
  disabled = false,
}: Props) {
  const update = useCallback(
    <K extends keyof AddressFields>(key: K, value: string) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange],
  );

  const handleRetrieve = useCallback(
    (res: RetrieveResponse) => {
      const props = res.features?.[0]?.properties;
      if (!props) return;
      onChange({
        address: props.address_line1 ?? props.feature_name ?? values.address,
        city: props.address_level2 ?? values.city,
        state: toStateCode(props.address_level1) || values.state,
        zip: props.postcode ?? values.zip,
      });
    },
    [values, onChange],
  );

  const hasToken = MAPBOX_TOKEN.length > 0;

  // Plain raw <input> that AddressAutofill can detect. We mimic the visual style
  // of <Input> (variant="labeled") or the compact <input> style (variant="compact").
  const addressInput = (
    <input
      name="address"
      autoComplete="address-line1"
      placeholder="123 Main St"
      value={values.address}
      onChange={(e) => update("address", e.target.value)}
      disabled={disabled}
      className={cn(
        variant === "labeled"
          ? "flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
          : "mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40",
        errors?.address && "border-red-500 focus:ring-red-500",
      )}
    />
  );

  if (variant === "labeled") {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className="text-sm font-medium text-slate-700">
            Address
          </label>
          {hasToken ? (
            <AddressAutofill
              accessToken={MAPBOX_TOKEN}
              options={{ country: "us" }}
              onRetrieve={handleRetrieve}
            >
              {addressInput}
            </AddressAutofill>
          ) : (
            addressInput
          )}
          {errors?.address && (
            <p className="text-xs text-red-600">{errors.address}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-sm font-medium text-slate-700">
              City
            </label>
            <input
              id="city"
              name="city"
              autoComplete="address-level2"
              placeholder="Austin"
              value={values.city}
              onChange={(e) => update("city", e.target.value)}
              disabled={disabled}
              className={cn(
                "flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
                errors?.city && "border-red-500 focus:ring-red-500",
              )}
            />
            {errors?.city && <p className="text-xs text-red-600">{errors.city}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium text-slate-700">
              State
            </label>
            <select
              id="state"
              name="state"
              autoComplete="address-level1"
              value={values.state}
              onChange={(e) => update("state", e.target.value)}
              disabled={disabled}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent touch-manipulation"
            >
              <option value="">Select</option>
              {US_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {errors?.state && <p className="text-xs text-red-600">{errors.state}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="zip" className="text-sm font-medium text-slate-700">
              Zip
            </label>
            <input
              id="zip"
              name="zip"
              autoComplete="postal-code"
              placeholder="78701"
              value={values.zip}
              onChange={(e) => update("zip", e.target.value)}
              disabled={disabled}
              className={cn(
                "flex h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00929C] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
                errors?.zip && "border-red-500 focus:ring-red-500",
              )}
            />
            {errors?.zip && <p className="text-xs text-red-600">{errors.zip}</p>}
          </div>
        </div>
      </>
    );
  }

  // variant === "compact" — matches CustomerInfoEditor styling
  return (
    <>
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold text-slate-600">Address</span>
        {hasToken ? (
          <AddressAutofill
            accessToken={MAPBOX_TOKEN}
            options={{ country: "us" }}
            onRetrieve={handleRetrieve}
          >
            {addressInput}
          </AddressAutofill>
        ) : (
          addressInput
        )}
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">City</span>
        <input
          type="text"
          name="city"
          autoComplete="address-level2"
          value={values.city}
          onChange={(e) => update("city", e.target.value)}
          disabled={disabled}
          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">State</span>
          <input
            type="text"
            name="state"
            autoComplete="address-level1"
            value={values.state}
            onChange={(e) => update("state", e.target.value)}
            disabled={disabled}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">ZIP</span>
          <input
            type="text"
            name="zip"
            autoComplete="postal-code"
            value={values.zip}
            onChange={(e) => update("zip", e.target.value)}
            disabled={disabled}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00929C]/40"
          />
        </label>
      </div>
    </>
  );
}
