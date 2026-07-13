"use client";

import { useState } from "react";
import { fullName } from "@/src/utils/formatName";
import { toDatetimeLocalValue } from "@/src/utils/formatDateTime";
import { api, apiFetch } from "@/src/lib/api/routes";

export interface RescheduleSession {
  id: number;
  start_time: string;
  end_time: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  reschedule_status: "pending" | null;
  students?: { first_name: string | null; last_name: string | null } | null;
}

interface RescheduleSessionModalProps {
  session: RescheduleSession;
  onClose: () => void;
  onSaved: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RescheduleSessionModal({
  session,
  onClose,
  onSaved,
}: RescheduleSessionModalProps) {
  const [startVal, setStartVal] = useState(() =>
    toDatetimeLocalValue(session.start_time),
  );
  const [endVal, setEndVal] = useState(() =>
    session.end_time ? toDatetimeLocalValue(session.end_time) : "",
  );
  const [saving, setSaving] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<
    "approve" | "decline" | null
  >(null);
  const [saveError, setSaveError] = useState("");

  const isPending = session.reschedule_status === "pending";
  const busy = saving || decisionLoading !== null;
  const studentName = fullName(
    session.students?.first_name,
    session.students?.last_name,
    "Session",
  );

  const handleSave = async () => {
    if (!startVal || !endVal) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await apiFetch(api.sessions.update(session.id), {
        method: "PATCH",
        json: {
          start_time: new Date(startVal).toISOString(),
          end_time: new Date(endVal).toISOString(),
        },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error ?? "Failed to save");
      } else {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (decision: "approve" | "decline") => {
    setDecisionLoading(decision);
    setSaveError("");
    try {
      const res = await apiFetch(
        api.sessions.rescheduleDecision(session.id, decision),
        { method: "POST" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error ?? `Failed to ${decision}`);
      } else {
        onSaved();
      }
    } finally {
      setDecisionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-[#2B4257] mb-1">
          {isPending ? "Reschedule Request" : "Reschedule Session"}
        </h2>
        <p className="text-sm text-[#2B4257]/50 mb-6">{studentName}</p>

        {isPending &&
          session.requested_start_time &&
          session.requested_end_time && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
              <p className="text-xs uppercase tracking-wide font-semibold text-amber-800 mb-2">
                Parent requested
              </p>
              <div className="space-y-1 text-amber-900">
                <div className="flex justify-between gap-3">
                  <span className="text-amber-900/70">Start</span>
                  <span className="font-medium text-right">
                    {formatDateTime(session.requested_start_time)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-amber-900/70">End</span>
                  <span className="font-medium text-right">
                    {formatDateTime(session.requested_end_time)}
                  </span>
                </div>
              </div>
            </div>
          )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2B4257] mb-1">
              {isPending ? "Current start" : "Start"}
            </label>
            <input
              type="datetime-local"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              className="w-full border border-[#2B4257]/20 rounded-lg px-3 py-2 text-sm text-[#2B4257] focus:outline-none focus:ring-2 focus:ring-[#2B4257]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2B4257] mb-1">
              {isPending ? "Current end" : "End"}
            </label>
            <input
              type="datetime-local"
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
              className="w-full border border-[#2B4257]/20 rounded-lg px-3 py-2 text-sm text-[#2B4257] focus:outline-none focus:ring-2 focus:ring-[#2B4257]/30"
            />
          </div>
        </div>

        {saveError && <p className="text-red-500 text-sm mt-3">{saveError}</p>}

        {isPending ? (
          <div className="mt-6 space-y-2">
            <div className="flex gap-3">
              <button
                onClick={() => handleDecision("decline")}
                disabled={busy}
                className="flex-1 min-h-11 py-2 rounded-lg border border-[#2B4257]/20 text-sm text-[#2B4257] font-medium hover:bg-[#2B4257]/5 disabled:opacity-50 transition-colors"
              >
                {decisionLoading === "decline" ? "Declining…" : "Decline"}
              </button>
              <button
                onClick={() => handleDecision("approve")}
                disabled={busy}
                className="flex-1 min-h-11 py-2 rounded-lg bg-[#65CFAD] text-sm text-[#1F2E3B] font-semibold hover:bg-[#50bfa0] disabled:opacity-50 transition-colors"
              >
                {decisionLoading === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 min-h-11 py-2 rounded-lg border border-[#2B4257]/20 text-xs text-[#2B4257]/70 hover:bg-[#2B4257]/5 disabled:opacity-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex-1 min-h-11 py-2 rounded-lg bg-[#2B4257] text-xs text-white font-medium hover:bg-[#2B4257]/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Current Times Instead"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 min-h-11 py-2 rounded-lg border border-[#2B4257]/20 text-sm text-[#2B4257] hover:bg-[#2B4257]/5 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex-1 min-h-11 py-2 rounded-lg bg-[#2B4257] text-sm text-white font-medium hover:bg-[#2B4257]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
