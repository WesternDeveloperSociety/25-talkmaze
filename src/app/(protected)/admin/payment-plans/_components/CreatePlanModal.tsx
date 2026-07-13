"use client";

import { useState } from "react";
import type { AdminPlan } from "../_types";
import { api, apiFetch } from "@/src/lib/api/routes";

const inputClass =
  "w-full bg-[#2B4257] border border-white/8 text-white placeholder:text-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#B1E7D6]/40 transition-colors";

type StripePreview = {
  product_name: string;
  amount: number;
  currency: string;
  interval: string | null;
  interval_count: number | null;
};

function formatInterval(interval: string | null, count: number | null) {
  if (!interval) return "—";
  if (count && count > 1) return `Every ${count} ${interval}s`;
  return `Per ${interval}`;
}

export default function CreatePlanModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (plan: AdminPlan) => void;
}) {
  const [priceId, setPriceId] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StripePreview | null>(null);

  const [name, setName] = useState("");
  const [classes, setClasses] = useState("");
  const [renewal, setRenewal] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function reset() {
    setPriceId("");
    setFetching(false);
    setFetchError(null);
    setPreview(null);
    setName("");
    setClasses("");
    setRenewal("");
    setType("");
    setDescription("");
    setSaving(false);
    setSaveError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFetch() {
    setFetchError(null);
    setPreview(null);
    if (!priceId.trim()) {
      setFetchError("Enter a Stripe Price ID.");
      return;
    }
    setFetching(true);
    try {
      const res = await apiFetch(
        api.paymentPlans.stripePreview({ priceId: priceId.trim() }),
      );
      if (!res.ok) {
        const body = await res.json();
        setFetchError(body.error ?? "Price ID not found in Stripe.");
        return;
      }
      const { preview: data } = (await res.json()) as {
        preview: StripePreview;
      };
      setPreview(data);
      setName(data.product_name);
      setRenewal(
        formatInterval(data.interval, data.interval_count).toLowerCase(),
      );
    } finally {
      setFetching(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    if (!name.trim() || !classes.trim() || !renewal.trim()) {
      setSaveError("Name, classes, and renewal are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(api.paymentPlans.create(), {
        method: "POST",
        json: {
          stripe_price_id: priceId.trim(),
          name: name.trim(),
          classes: Number(classes),
          renewal: renewal.trim(),
          type: type.trim() || null,
          description: description.trim() || null,
        },
      });
      if (!res.ok) {
        const body = await res.json();
        setSaveError(body.error ?? "Failed to create plan.");
        return;
      }
      const body = await res.json();
      const plan: AdminPlan = body?.plan ?? body;
      reset();
      onSuccess(plan);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full h-full sm:h-auto sm:max-w-md bg-[#1F2E3B] rounded-none sm:rounded-2xl border border-white/8 shadow-2xl overflow-hidden flex flex-col sm:block">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-white font-bold text-base">Add payment plan</h3>
          <button
            onClick={handleClose}
            className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-white/35 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 sm:flex-none sm:max-h-[70vh] overflow-y-auto">
          {/* Step 1: Stripe Price ID */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">
              Stripe Price ID
            </label>
            <div className="flex gap-2">
              <input
                value={priceId}
                onChange={(e) => {
                  setPriceId(e.target.value);
                  setPreview(null);
                  setFetchError(null);
                }}
                placeholder="price_xxx…"
                className={inputClass}
                disabled={fetching}
              />
              <button
                onClick={handleFetch}
                disabled={fetching || !priceId.trim()}
                className="shrink-0 min-h-[44px] md:min-h-0 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors disabled:opacity-40"
              >
                {fetching ? "…" : "Fetch"}
              </button>
            </div>
            {fetchError && (
              <p className="text-red-400 text-xs mt-1">{fetchError}</p>
            )}
          </div>

          {/* Stripe preview */}
          {preview && (
            <div className="bg-[#2B4257] rounded-xl p-3 border border-[#B1E7D6]/20 space-y-1.5">
              <p className="text-[#B1E7D6] text-xs font-semibold uppercase tracking-wide">
                Stripe preview
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <p className="text-white/35 text-xs">Product</p>
                  <p className="text-white text-sm">{preview.product_name}</p>
                </div>
                <div>
                  <p className="text-white/35 text-xs">Price</p>
                  <p className="text-white text-sm">
                    {new Intl.NumberFormat("en-CA", {
                      style: "currency",
                      currency: preview.currency,
                    }).format((preview.amount ?? 0) / 100)}{" "}
                    {preview.currency}
                  </p>
                </div>
                <div>
                  <p className="text-white/35 text-xs">Interval</p>
                  <p className="text-white text-sm">
                    {formatInterval(preview.interval, preview.interval_count)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: editable fields (unlocked after fetch) */}
          {preview && (
            <>
              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Plan name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Classes per period <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={classes}
                  onChange={(e) => setClasses(e.target.value)}
                  placeholder="e.g. 3"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Renewal display text <span className="text-red-400">*</span>
                </label>
                <input
                  value={renewal}
                  onChange={(e) => setRenewal(e.target.value)}
                  placeholder="e.g. per 3 months"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Type label
                </label>
                <input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. 3 Classes"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-2 justify-end">
          <button
            onClick={handleClose}
            className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold text-white/50 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
          >
            Cancel
          </button>
          {preview && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold bg-[#B1E7D6] text-[#1F2E3B] rounded-xl hover:bg-[#9ed4c1] transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
