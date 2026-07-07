import { Card } from "@/src/components/ui/card";
import { BillingHistory } from "./BillingHistory";

export function OverviewPanel({
  planName,
  amountDisplay,
  mode = "purchase",
  effectiveDate,
}: {
  planName: string;
  amountDisplay: string;
  mode?: "purchase" | "schedule";
  effectiveDate?: string | null;
}) {
  const isSchedule = mode === "schedule";

  return (
    <Card
      variant="dark"
      shadow="md"
      padding="none"
      className="w-full gap-5 rounded-xl border-[0.5px] border-black p-4 sm:p-8"
    >
      <h1 className="text-2xl font-bold mb-0">Overview</h1>
      <div className="flex flex-col self-center w-full max-w-[500px] relative bg-accent rounded-xl p-4 sm:p-6 text-[#1f2e3b]">
        <h2 className="text-2xl font-bold mt-0 mb-2.5 text-[#1f2e3b]">
          {isSchedule ? "TalkMaze Plan Change:" : "TalkMaze Package Renewal:"}
        </h2>
        <div className="flex flex-wrap justify-center items-center gap-1.5 bg-white rounded-lg p-3 sm:p-5 mt-[15px] shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] text-base sm:text-xl">
          <span>{planName}</span>
          <span>|</span>
          <span className="font-bold text-black">{amountDisplay} (CA)</span>
        </div>
        {isSchedule && effectiveDate && (
          <div className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#2b4257]">
            Starts on {effectiveDate}
          </div>
        )}
        <div className="mt-[15px] text-base underline cursor-pointer text-[#1f2e3b]">
          See more details
        </div>
      </div>

      <BillingHistory className="mt-auto" />
    </Card>
  );
}
