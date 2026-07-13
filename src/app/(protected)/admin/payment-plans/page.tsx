"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import PlanListItem from "./_components/PlanListItem";
import { useDocumentTitle } from "@/src/hooks/useDocumentTitle";
import PlanDetailPanel from "./_components/PlanDetailPanel";
import CreatePlanModal from "./_components/CreatePlanModal";
import { useAdminMobileDetail } from "../_context/AdminMobileDetailContext";
import type { AdminPlan } from "./_types";
import { api, apiFetch } from "@/src/lib/api/routes";

const inputClass =
  "w-full bg-[#1F2E3B] border border-white/8 text-white placeholder:text-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#B1E7D6]/40 transition-colors";

export default function PaymentPlansPage() {
  useDocumentTitle("Payment Plans");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const { setHasDetail } = useAdminMobileDetail();

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    async function fetchPlans() {
      try {
        setLoading(true);
        const res = await apiFetch(api.paymentPlans.list());
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPlans(Array.isArray(data?.plans) ? data.plans : []);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  useEffect(() => {
    setHasDetail(!!selectedId);
    return () => setHasDetail(false);
  }, [selectedId, setHasDetail]);

  const filteredPlans = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, search]);

  function handleUpdate(updated: AdminPlan) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleArchive(id: string) {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)),
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#B1E7D6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* List panel */}
      <div
        className={`shrink-0 w-full md:w-72 lg:w-80 xl:w-[340px] bg-[#162330] border-r border-white/5 flex flex-col overflow-hidden
          ${selectedId ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-3 border-b border-white/5 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="Search plans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            title="Add plan"
            className="shrink-0 w-10 h-10 bg-[#B1E7D6] text-[#1F2E3B] rounded-xl flex items-center justify-center font-bold text-lg hover:bg-[#9ed4c1] transition-colors"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredPlans.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-12">
              No plans found
            </p>
          ) : (
            filteredPlans.map((p) => (
              <PlanListItem
                key={p.id}
                plan={p}
                isSelected={p.id === selectedId}
                onClick={() => router.push(`?id=${p.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div
        className={`flex-1 min-w-0 overflow-y-auto
          ${!selectedId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
      >
        {!selectedPlan && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-sm">
              Select a plan to view details
            </p>
          </div>
        )}
        {selectedPlan && (
          <PlanDetailPanel
            plan={selectedPlan}
            onUpdate={handleUpdate}
            onArchive={handleArchive}
          />
        )}
      </div>

      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(plan) => {
          setPlans((prev) => [...prev, plan].sort((a, b) => a.cents - b.cents));
          setIsCreateModalOpen(false);
          router.push(`?id=${plan.id}`);
        }}
      />
    </div>
  );
}
