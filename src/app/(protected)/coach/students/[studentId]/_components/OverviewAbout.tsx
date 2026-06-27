import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

interface OverviewAboutProps {
  bio: string | null;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
  streak: number;
  preferredTime: string | null;
  parentName: string | null;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#2B4257]/10 py-2.5 text-sm first:border-t-0">
      <span className="text-[#2B4257]/60">{label}</span>
      <span className="text-right font-medium text-[#1F2E3B]">{value}</span>
    </div>
  );
}

/** The Overview "About" card: bio quote + key student facts. */
export default function OverviewAbout({
  bio,
  sessionsRemaining,
  sessionsTotal,
  streak,
  preferredTime,
  parentName,
}: OverviewAboutProps) {
  const sessionsValue =
    sessionsRemaining == null
      ? "—"
      : sessionsTotal != null
        ? `${sessionsRemaining} / ${sessionsTotal}`
        : String(sessionsRemaining);

  return (
    <Card variant="light" padding="md" shadow="md" className="gap-3">
      <CardHeader>
        <CardTitle className="font-semibold text-[#2B4257]">
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bio && (
          <blockquote className="border-l-2 border-[#65CFAD] pl-3 text-sm italic text-[#2B4257]/70">
            “{bio}”
          </blockquote>
        )}
        <div>
          <Row label="Sessions remaining" value={sessionsValue} />
          <Row label="Attendance streak" value={streak} />
          <Row label="Preferred time" value={preferredTime ?? "Not set"} />
          <Row label="Parent" value={parentName ?? "—"} />
        </div>
      </CardContent>
    </Card>
  );
}
