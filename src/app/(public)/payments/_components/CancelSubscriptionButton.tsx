"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { api, apiFetch } from "@/src/lib/api/routes";

type Props = {
  studentId?: string;
  isEligibleForRefund: boolean;
  periodEndDate: string | null;
  refundOnly?: boolean;
};

type UIState =
  | "idle"
  | "choosing"
  | "confirmingRefund"
  | "confirmingNoRenew"
  | "loading";

export default function CancelSubscriptionButton({
  studentId,
  isEligibleForRefund,
  periodEndDate,
  refundOnly = false,
}: Props) {
  const [state, setState] = useState<UIState>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(refund: boolean) {
    setState("loading");
    setError(null);
    try {
      const res = await apiFetch(
        api.students.subscription.cancel(studentId ?? ""),
        { method: "POST", json: { refund } },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to cancel subscription");
        setState(refund ? "confirmingRefund" : "confirmingNoRenew");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to cancel subscription");
      setState(refund ? "confirmingRefund" : "confirmingNoRenew");
    }
  }

  function handleInitialClick() {
    setError(null);
    if (refundOnly) {
      setState("confirmingRefund");
    } else if (isEligibleForRefund) {
      setState("choosing");
    } else {
      setState("confirmingNoRenew");
    }
  }

  if (state === "idle") {
    return (
      <Button
        variant={refundOnly ? "destructive" : "secondary"}
        size="md"
        rounded="full"
        onClick={handleInitialClick}
      >
        {refundOnly ? "Cancel & get full refund" : "Cancel plan"}
      </Button>
    );
  }

  if (state === "choosing") {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <p className="text-sm font-semibold text-[#2b4257]">
          How would you like to cancel?
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {/* Option A: Refund */}
          <button
            onClick={() => setState("confirmingRefund")}
            className="flex-1 flex flex-col gap-1 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-left cursor-pointer hover:bg-red-100 transition-colors"
          >
            <span className="text-sm font-bold text-red-700">
              Cancel &amp; get full refund
            </span>
            <span className="text-xs text-red-600">
              Subscription ends immediately. Full payment refunded.
            </span>
          </button>
          {/* Option B: Stop auto-renewal */}
          <button
            onClick={() => setState("confirmingNoRenew")}
            className="flex-1 flex flex-col gap-1 rounded-xl border-2 border-[#2b4257]/30 bg-white px-4 py-3 text-left cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-bold text-[#2b4257]">
              Turn off auto-renewal
            </span>
            <span className="text-xs text-[#2b4257]/70">
              {periodEndDate
                ? `Access continues until ${periodEndDate}. No refund.`
                : "Access continues until period end. No refund."}
            </span>
          </button>
        </div>
        <button
          onClick={() => setState("idle")}
          className="text-xs text-[#2b4257]/60 hover:text-[#2b4257] underline cursor-pointer bg-transparent border-0"
        >
          Go back
        </button>
      </div>
    );
  }

  if (state === "confirmingRefund") {
    return (
      <div className="flex flex-col items-center gap-2">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <p className="text-sm font-semibold text-red-700 text-center">
          This cannot be undone. Your subscription ends immediately and your
          payment will be refunded.
        </p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="md"
            rounded="full"
            onClick={() => submit(true)}
          >
            Yes, cancel and refund
          </Button>
          {/* Light-surface secondary action — kept raw (dark-UI outline variant
              would render white-on-white here) */}
          <button
            onClick={() => setState("choosing")}
            className="bg-white text-[#2b4257] rounded-full px-6 py-3 text-sm font-semibold shadow-md hover:bg-gray-100 transition-colors cursor-pointer border border-[#2b4257]"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (state === "confirmingNoRenew") {
    return (
      <div className="flex flex-col items-center gap-2">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <p className="text-sm text-[#2b4257] font-medium">Are you sure?</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            rounded="full"
            onClick={() => submit(false)}
          >
            Confirm cancel
          </Button>
          {/* Light-surface secondary action — kept raw (see note above) */}
          <button
            onClick={() => setState(isEligibleForRefund ? "choosing" : "idle")}
            className="bg-white text-[#2b4257] rounded-full px-6 py-3 text-sm font-semibold shadow-md hover:bg-gray-100 transition-colors cursor-pointer border border-[#2b4257]"
          >
            Keep plan
          </button>
        </div>
      </div>
    );
  }

  // loading state
  return (
    <Button variant="secondary" size="md" rounded="full" disabled>
      Cancelling...
    </Button>
  );
}
