"use client";

import { useEffect, useState, Suspense, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { signOut } from "@/src/lib/auth/actions/signOut";
import { api } from "@/src/lib/api/routes";
import CreateAdminModal from "./_components/CreateAdminModal";
import {
  AdminMobileDetailProvider,
  useAdminMobileDetail,
} from "./_context/AdminMobileDetailContext";

const NAV_ITEMS = [
  { key: "students", label: "Students", href: "/admin/students" },
  { key: "coaches", label: "Coaches", href: "/admin/coaches" },
  { key: "courses", label: "Courses", href: "/admin/courses" },
  { key: "assignments", label: "Assignments", href: "/admin/assignments" },
  { key: "pending", label: "Pending", href: "/admin/pending" },
  { key: "payment-plans", label: "Plans", href: "/admin/payment-plans" },
] as const;

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasDetail } = useAdminMobileDetail();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);

  useEffect(() => {
    async function checkAdminRole() {
      try {
        const res = await fetch(api.me());
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.role !== 3) router.push("/student");
        else setIsAuthorized(true);
      } catch {
        router.push("/student");
      }
    }
    checkAdminRole();
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#2B4257] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#B1E7D6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="h-screen bg-[#2B4257] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-[#1F2E3B] border-b border-white/8 shadow-[0_2px_12px_rgba(0,0,0,0.3)] z-10">
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5">
          <div className="flex items-center gap-3">
            {hasDetail && (
              <button
                onClick={() => router.back()}
                aria-label="Back"
                className="md:hidden -ml-1 w-11 h-11 flex items-center justify-center text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <h1 className="text-white font-bold text-base leading-none">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateAdminModalOpen(true)}
              className="bg-[#B1E7D6] text-[#1F2E3B] font-semibold text-xs px-3.5 py-2 min-h-11 rounded-xl hover:bg-[#9ed4c1] transition-colors shadow-[0_4px_12px_rgba(177,231,214,0.2)]"
            >
              + Admin
            </button>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="text-white/70 hover:text-white hover:bg-white/10 font-semibold text-xs px-3.5 py-2 min-h-11 min-w-11 rounded-xl transition-colors flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="sr-only sm:not-sr-only sm:ml-1.5">
                  Sign out
                </span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col shrink-0 w-16 lg:w-56 bg-[#1F2E3B] border-r border-white/5 py-3 px-2 gap-0.5">
          {NAV_ITEMS.map(({ key, label, href }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                className={`px-3 py-2.5 rounded-xl transition-all text-left text-sm font-semibold ${
                  isActive
                    ? "bg-[#B1E7D6] text-[#1F2E3B]"
                    : "text-white/45 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="hidden lg:inline">{label}</span>
                <span className="lg:hidden text-xs">{label.slice(0, 3)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Content area */}
        <div className="flex flex-1 min-w-0 overflow-hidden">{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden shrink-0 bg-[#1F2E3B] border-t border-white/10 flex safe-bottom">
        {NAV_ITEMS.map(({ key, label, href }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              className={`flex-1 min-h-11 py-3 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide transition-colors text-center ${
                isActive
                  ? "text-[#B1E7D6]"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <CreateAdminModal
        isOpen={isCreateAdminModalOpen}
        onClose={() => setIsCreateAdminModalOpen(false)}
        onSuccess={() => alert("Admin account created successfully!")}
      />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminMobileDetailProvider>
      <Suspense>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </Suspense>
    </AdminMobileDetailProvider>
  );
}
