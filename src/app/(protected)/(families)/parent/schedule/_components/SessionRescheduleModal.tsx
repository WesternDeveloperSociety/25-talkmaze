"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionProp } from "./types";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/src/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/src/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { formatDateTime, getDurationMin } from "../_lib/sessionDateUtils";
import { toDatetimeLocalValue } from "@/src/utils/formatDateTime";
import { api, apiFetch } from "@/src/lib/api/routes";

interface Props {
  session: SessionProp;
  onClose: () => void;
  initialMode?: Mode;
}

type Mode = "view" | "edit";

export default function SessionRescheduleModal({
  session,
  onClose,
  initialMode = "view",
}: Props) {
  const router = useRouter();
  const durationMin = getDurationMin(session.start_time, session.end_time);
  const isPending = session.reschedule_status === "pending";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [startVal, setStartVal] = useState(
    toDatetimeLocalValue(session.start_time),
  );
  const [endVal, setEndVal] = useState(
    session.end_time ? toDatetimeLocalValue(session.end_time) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmitRequest = async () => {
    if (!startVal || !endVal) {
      setError("Please provide both a start and end time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch(api.sessions.rescheduleRequest(session.id), {
        method: "POST",
        json: {
          requested_start_time: new Date(startVal).toISOString(),
          requested_end_time: new Date(endVal).toISOString(),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to submit request");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch(api.sessions.rescheduleRequest(session.id), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to withdraw request");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent variant="light" size="md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Request Reschedule" : "Session Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? `Pick a new time for ${session.studentName}'s session with ${
                  session.coachName || "their coach"
                }. Your coach will be asked to approve before anything changes.`
              : "Review the details for this session."}
          </DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <>
            <div className="space-y-3 text-sm text-[#2B4257]">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#2B4257]/60">
                  Student
                </p>
                <p className="font-medium">{session.studentName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#2B4257]/60">
                  Coach
                </p>
                <p className="font-medium">
                  {session.coachName || "Not assigned"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#2B4257]/60">
                  Start
                </p>
                <p className="font-medium">
                  {formatDateTime(session.start_time)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#2B4257]/60">
                  End
                </p>
                <p className="font-medium">
                  {session.end_time ? formatDateTime(session.end_time) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#2B4257]/60">
                  Duration
                </p>
                <p className="font-medium">
                  {durationMin !== null ? `${durationMin} minutes` : "—"}
                </p>
              </div>

              {isPending &&
                session.requested_start_time &&
                session.requested_end_time && (
                  <Alert
                    variant="warning"
                    size="sm"
                    className="mt-2 rounded-xl p-3"
                  >
                    <AlertTitle className="uppercase tracking-wide">
                      Reschedule pending
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mt-1">
                        Waiting for your coach to respond. We&apos;ll show the
                        new time here once they approve.
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between gap-3">
                          <span className="opacity-70">Requested start</span>
                          <span className="font-medium text-right">
                            {formatDateTime(session.requested_start_time)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="opacity-70">Requested end</span>
                          <span className="font-medium text-right">
                            {formatDateTime(session.requested_end_time)}
                          </span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <DialogFooter>
              {isPending ? (
                <Button
                  variant="outline-light"
                  size="md"
                  onClick={handleWithdraw}
                  disabled={submitting}
                >
                  {submitting ? "Withdrawing…" : "Withdraw request"}
                </Button>
              ) : (
                <Button
                  variant="outline-light"
                  size="md"
                  onClick={() => {
                    setError("");
                    setMode("edit");
                  }}
                >
                  Request Reschedule
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 text-sm text-[#2B4257]">
              <Field>
                <FieldLabel htmlFor="reschedule-start">Start</FieldLabel>
                <Input
                  id="reschedule-start"
                  type="datetime-local"
                  size="sm"
                  value={startVal}
                  onChange={(e) => setStartVal(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reschedule-end">End</FieldLabel>
                <Input
                  id="reschedule-end"
                  type="datetime-local"
                  size="sm"
                  value={endVal}
                  onChange={(e) => setEndVal(e.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </div>

            <DialogFooter>
              <Button
                variant="outline-light"
                size="md"
                onClick={() => {
                  setError("");
                  setMode("view");
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
