"use client";

import { useState, useEffect } from "react";
import { api, apiFetch } from "@/src/lib/api/routes";
import type { Coach } from "../../_types";

type Availability = Record<string, { start: string; end: string }[]>;

const DAY_MAP: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface Props {
  employee: Coach;
  onClose: () => void;
  onUpdate: (updated: Coach) => void;
}

const inputClass =
  "mt-1 block w-full bg-[#2B4257] border border-white/10 text-white placeholder:text-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B1E7D6]/50 transition-colors";

const labelClass =
  "block text-[10px] font-semibold text-[#B1E7D6] uppercase tracking-widest mb-0.5";

export default function EmployeeDetailModal({
  employee,
  onClose,
  onUpdate,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Coach>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [availability, setAvailability] = useState<Availability>({});

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    async function fetchAvailability() {
      const res = await apiFetch(api.coaches.availability(employee.id));
      if (!res.ok) return;
      const body = await res.json();
      const rows: { weekday: number; start_time: string; end_time: string }[] =
        Array.isArray(body?.availability) ? body.availability : [];
      const mapped: Availability = {};
      rows.forEach(({ weekday, start_time, end_time }) => {
        const day = DAY_MAP[weekday];
        const start = start_time.slice(11, 16);
        const end = end_time.slice(11, 16);
        if (!mapped[day]) mapped[day] = [];
        mapped[day].push({ start, end });
      });
      setAvailability(mapped);
    }
    fetchAvailability();
  }, [employee.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch(api.coaches.update(employee.id), {
        method: "PATCH",
        json: { employee: editForm },
      });
      if (!response.ok) throw new Error("Failed to update employee");
      const updated = await response.json();
      onUpdate(updated?.employee ?? updated);
      setIsEditing(false);
      setEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAvailability = async () => {
    const res = await apiFetch(api.coaches.availability(employee.id), {
      method: "PUT",
      json: { availability },
    });
    if (!res.ok) {
      alert("Failed to save availability");
      return;
    }
    alert("Availability saved!");
  };

  const Field = ({
    label,
    fieldKey,
    colSpan = "",
  }: {
    label: string;
    fieldKey: keyof Coach;
    colSpan?: string;
  }) => (
    <div className={colSpan}>
      <p className={labelClass}>{label}</p>
      {isEditing ? (
        <input
          type="text"
          value={(editForm[fieldKey] as string) ?? ""}
          onChange={(e) =>
            setEditForm((p) => ({ ...p, [fieldKey]: e.target.value }))
          }
          className={inputClass}
        />
      ) : (
        <p className="text-white text-sm font-medium">
          {(employee[fieldKey] as string) || "—"}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-0 sm:p-4 z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1F2E3B] rounded-none sm:rounded-2xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1F2E3B] border-b border-white/10 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h2 className="text-white font-bold text-lg">
              {isEditing
                ? `${(editForm as any).first_name ?? employee.first_name} ${(editForm as any).last_name ?? employee.last_name}`
                : `${employee.first_name} ${employee.last_name}`}
            </h2>
            <p className="text-[#B1E7D6] text-xs opacity-60 mt-0.5">
              Coach profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditForm({ ...employee });
                    setIsEditing(true);
                  }}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#B1E7D6] hover:bg-[#9ed4c1] rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-lg"
                >
                  ×
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#65CFAD] hover:bg-[#50bfa0] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditForm({});
                    setIsEditing(false);
                  }}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={labelClass}>Coach ID</p>
                <p className="text-white/80 text-sm font-mono">{employee.id}</p>
              </div>
              <div>
                <p className={labelClass}>Account ID</p>
                <p className="text-white/80 text-sm font-mono">
                  {employee.account_id}
                </p>
              </div>
              <Field label="First Name" fieldKey="first_name" />
              <Field label="Last Name" fieldKey="last_name" />
            </div>
          </section>

          {/* Timestamps */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Timestamps
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={labelClass}>Created At</p>
                <p className="text-white/60 text-sm">
                  {employee.created_at || "—"}
                </p>
              </div>
              <div>
                <p className={labelClass}>Updated At</p>
                <p className="text-white/60 text-sm">
                  {employee.updated_at || "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Availability */}
          <section>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
              <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest">
                Weekly Availability
              </h3>
              <button
                onClick={handleSaveAvailability}
                className="min-h-[44px] md:min-h-0 px-3 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#65CFAD] hover:bg-[#50bfa0] rounded-lg transition-colors"
              >
                Save Availability
              </button>
            </div>

            <div className="space-y-2">
              {DAYS.map((day) => {
                const enabled = !!availability[day];
                const slots = availability[day] || [];
                return (
                  <div
                    key={day}
                    className={`rounded-xl p-3 border transition-colors ${enabled ? "bg-[#2B4257]/60 border-[#B1E7D6]/20" : "bg-[#2B4257]/20 border-white/5"}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white">
                        {day}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() =>
                            setAvailability((prev) => {
                              const copy = { ...prev };
                              if (copy[day]) delete copy[day];
                              else copy[day] = [{ start: "", end: "" }];
                              return copy;
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-[#B1E7D6]" />
                        <div className="absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
                      </label>
                    </div>

                    {enabled && (
                      <div className="flex flex-col gap-2 mt-3">
                        {slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) =>
                                setAvailability((prev) => {
                                  const updated = [...prev[day]];
                                  updated[idx] = {
                                    ...updated[idx],
                                    start: e.target.value,
                                  };
                                  return { ...prev, [day]: updated };
                                })
                              }
                              className="bg-[#1F2E3B] border border-white/10 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#B1E7D6]/50"
                            />
                            <span className="text-white/30 text-xs">–</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) =>
                                setAvailability((prev) => {
                                  const updated = [...prev[day]];
                                  updated[idx] = {
                                    ...updated[idx],
                                    end: e.target.value,
                                  };
                                  return { ...prev, [day]: updated };
                                })
                              }
                              className="bg-[#1F2E3B] border border-white/10 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#B1E7D6]/50"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAvailability((prev) => {
                                  const filtered = prev[day].filter(
                                    (_, i) => i !== idx,
                                  );
                                  const copy = { ...prev };
                                  if (filtered.length === 0) delete copy[day];
                                  else copy[day] = filtered;
                                  return copy;
                                })
                              }
                              className="text-red-400/70 hover:text-red-400 text-xs transition-colors ml-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setAvailability((prev) => ({
                              ...prev,
                              [day]: [...prev[day], { start: "", end: "" }],
                            }))
                          }
                          className="text-xs text-[#B1E7D6]/70 hover:text-[#B1E7D6] transition-colors mt-1 text-left"
                        >
                          + Add slot
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
