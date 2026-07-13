"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { api, apiFetch } from "@/src/lib/api/routes";

export default function CancelScheduleButton({
  studentId,
}: {
  studentId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCancel = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        api.students.subscription.schedule(studentId ?? ""),
        { method: "DELETE" },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to cancel plan change");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to cancel plan change");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button
        variant="secondary"
        size="md"
        rounded="full"
        onClick={handleCancel}
        disabled={loading}
      >
        {loading ? "Cancelling..." : "Cancel plan change"}
      </Button>
    </div>
  );
}
