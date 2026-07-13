"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RescheduleRequestCard from "./_components/RescheduleRequestCard";
import type { RescheduleRequest } from "./types";
import { formatDateTime } from "./formatters";
import { api, apiFetch } from "@/src/lib/api/routes";

export default function RescheduleRequestsClient() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<
    "approve" | "decline" | null
  >(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(api.rescheduleRequests.list());
    const data = await res.json();
    const list: RescheduleRequest[] = data.requests ?? [];
    setRequests(list);
    setSelectedId((prev) =>
      prev && list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? null),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId],
  );

  const handleDecision = async (decision: "approve" | "decline") => {
    if (!selected) return;
    setDecisionLoading(decision);
    setError("");
    try {
      const res = await apiFetch(
        api.sessions.rescheduleDecision(selected.id, decision),
        { method: "POST" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed to ${decision}`);
        return;
      }
      await loadRequests();
    } finally {
      setDecisionLoading(null);
    }
  };

  const selectedStudentName = selected?.students
    ? `${selected.students.first_name ?? ""} ${
        selected.students.last_name ?? ""
      }`.trim() || "Student"
    : "Student";

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-xl font-bold">Reschedule Requests</h2>
          <p className="text-white/35 text-sm mt-1">
            Pending parent requests, oldest first. Approve to apply the new
            time, or decline to keep the session as-is.
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="shrink-0 min-h-11 px-4 py-2.5 md:min-h-0 md:px-3.5 md:py-2 text-xs font-semibold text-[#1F2E3B] bg-[#B1E7D6] hover:bg-[#9ed4c1] rounded-xl transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-[#B1E7D6] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-[#1F2E3B] rounded-2xl p-8 border border-white/5 text-center">
          <p className="text-white/35 text-sm">No pending reschedule requests</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          {/* Left: list */}
          <div className="space-y-2">
            {requests.map((r) => (
              <RescheduleRequestCard
                key={r.id}
                request={r}
                isSelected={r.id === selectedId}
                onClick={() => setSelectedId(r.id)}
              />
            ))}
          </div>

          {/* Right: detail */}
          {selected && (
            <div className="bg-[#1F2E3B] rounded-2xl p-5 border border-white/5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-white text-lg font-semibold">
                  {selectedStudentName}
                </h3>
                <span className="text-xs uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  Pending
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs uppercase tracking-wide font-semibold text-white/50">
                    Current
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="text-white/70">Start</div>
                    <div className="text-white font-medium">
                      {selected.start_time
                        ? formatDateTime(selected.start_time)
                        : "—"}
                    </div>
                    <div className="text-white/70 pt-2">End</div>
                    <div className="text-white font-medium">
                      {selected.end_time
                        ? formatDateTime(selected.end_time)
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-100 border border-amber-300">
                  <p className="text-xs uppercase tracking-wide font-semibold text-amber-800">
                    Requested
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="text-amber-900/70">Start</div>
                    <div className="text-amber-900 font-medium">
                      {selected.requested_start_time
                        ? formatDateTime(selected.requested_start_time)
                        : "—"}
                    </div>
                    <div className="text-amber-900/70 pt-2">End</div>
                    <div className="text-amber-900 font-medium">
                      {selected.requested_end_time
                        ? formatDateTime(selected.requested_end_time)
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-300 text-sm mt-4">{error}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleDecision("decline")}
                  disabled={decisionLoading !== null}
                  className="flex-1 min-h-11 py-2.5 rounded-xl border border-white/20 text-sm text-white font-medium hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  {decisionLoading === "decline" ? "Declining…" : "Decline"}
                </button>
                <button
                  onClick={() => handleDecision("approve")}
                  disabled={decisionLoading !== null}
                  className="flex-1 min-h-11 py-2.5 rounded-xl bg-[#65CFAD] text-sm text-[#1F2E3B] font-semibold hover:bg-[#50bfa0] disabled:opacity-50 transition-colors"
                >
                  {decisionLoading === "approve" ? "Approving…" : "Approve"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
