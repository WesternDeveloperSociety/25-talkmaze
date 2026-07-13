"use client";

import { useState } from "react";
import type { AdminPlan } from "../_types";
import { api, apiFetch } from "@/src/lib/api/routes";

const inputClass =
  "w-full bg-[#2B4257] border border-white/8 text-white placeholder:text-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#B1E7D6]/40 transition-colors";

const CURRENCY_NORMALIZE: Record<string, string> = { CA: "CAD" };

function formatPrice(cents: number, currency: string) {
  const code =
    CURRENCY_NORMALIZE[currency.toUpperCase()] ?? currency.toUpperCase();
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatInterval(
  interval: string | null | undefined,
  count: number | null | undefined,
) {
  if (!interval) return "—";
  if (count && count > 1) return `Every ${count} ${interval}s`;
  return `Per ${interval}`;
}

export default function PlanDetailPanel({
  plan,
  onUpdate,
  onArchive,
}: {
  plan: AdminPlan;
  onUpdate: (updated: AdminPlan) => void;
  onArchive: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [classes, setClasses] = useState(String(plan.classes));
  const [renewal, setRenewal] = useState(plan.renewal);
  const [type, setType] = useState(plan.type ?? "");

  function resetForm() {
    setName(plan.name);
    setDescription(plan.description ?? "");
    setClasses(String(plan.classes));
    setRenewal(plan.renewal);
    setType(plan.type ?? "");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim() || !classes.trim() || !renewal.trim()) {
      setError("Name, classes, and renewal are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(api.paymentPlans.update(plan.id), {
        method: "PATCH",
        json: {
          name: name.trim(),
          description: description.trim() || null,
          classes: Number(classes),
          renewal: renewal.trim(),
          type: type.trim() || null,
        },
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate({ ...plan, ...(updated?.plan ?? updated) });
      setEditing(false);
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await apiFetch(api.paymentPlans.archive(plan.id), {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      onArchive(plan.id);
    } catch {
      setError("Failed to archive plan.");
    } finally {
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white text-xl font-bold leading-tight">
            {plan.name}
          </h2>
          <p className="text-white/35 text-xs mt-0.5">{plan.stripe_price_id}</p>
        </div>
        {!editing && (
          <button
            onClick={() => {
              resetForm();
              setEditing(true);
            }}
            className="shrink-0 min-h-[44px] md:min-h-0 px-3.5 py-1.5 text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Stripe read-only info */}
      <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5 space-y-3">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          From Stripe (read-only)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/35 text-xs mb-0.5">Price</p>
            <p className="text-white text-sm font-semibold">
              {formatPrice(plan.cents, plan.currency)} {plan.currency}
            </p>
          </div>
          <div>
            <p className="text-white/35 text-xs mb-0.5">Billing interval</p>
            <p className="text-white text-sm font-semibold">
              {formatInterval(plan.stripe_interval, plan.stripe_interval_count)}
            </p>
          </div>
          {plan.stripe_product_name && (
            <div className="col-span-2">
              <p className="text-white/35 text-xs mb-0.5">
                Stripe product name
              </p>
              <p className="text-white text-sm">{plan.stripe_product_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Editable fields */}
      {editing ? (
        <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5 space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">
            Edit plan
          </p>

          <div>
            <label className="text-white/50 text-xs mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">
              Classes per period
            </label>
            <input
              type="number"
              min={1}
              value={classes}
              onChange={(e) => setClasses(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">
              Renewal display text
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

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold bg-[#B1E7D6] text-[#1F2E3B] rounded-xl hover:bg-[#9ed4c1] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold text-white/50 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-white/35 text-xs mb-0.5">Classes per period</p>
              <p className="text-white text-sm font-semibold">{plan.classes}</p>
            </div>
            <div>
              <p className="text-white/35 text-xs mb-0.5">Renewal text</p>
              <p className="text-white text-sm">{plan.renewal}</p>
            </div>
            {plan.type && (
              <div>
                <p className="text-white/35 text-xs mb-0.5">Type label</p>
                <p className="text-white text-sm">{plan.type}</p>
              </div>
            )}
            <div>
              <p className="text-white/35 text-xs mb-0.5">Status</p>
              <p
                className={`text-sm font-semibold ${plan.is_active ? "text-[#B1E7D6]" : "text-white/35"}`}
              >
                {plan.is_active ? "Active" : "Archived"}
              </p>
            </div>
          </div>
          {plan.description && (
            <div>
              <p className="text-white/35 text-xs mb-0.5">Description</p>
              <p className="text-white/60 text-sm leading-relaxed">
                {plan.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Archive */}
      {plan.is_active && !editing && (
        <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
          {confirmArchive ? (
            <div className="space-y-3">
              <p className="text-white/60 text-sm">
                Archive this plan? It won&apos;t appear as a purchase option.
                Existing subscribers are unaffected.
              </p>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors disabled:opacity-50"
                >
                  {archiving ? "Archiving…" : "Yes, archive"}
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold text-white/50 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmArchive(true)}
              className="min-h-[44px] md:min-h-0 text-xs font-semibold text-white/35 hover:text-red-400 transition-colors"
            >
              Archive this plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
