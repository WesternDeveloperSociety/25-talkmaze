"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { api, apiFetch } from "@/src/lib/api/routes";

export default function ResumeSubscriptionButton({
  studentId,
}: {
  studentId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleResume() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        api.students.subscription.resume(studentId ?? ""),
        { method: "POST" },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to resume subscription");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to resume subscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button
        variant="default"
        size="md"
        rounded="full"
        onClick={handleResume}
        disabled={loading}
      >
        {loading ? "Resuming..." : "Resume auto-renewal"}
      </Button>
    </div>
  );
}
