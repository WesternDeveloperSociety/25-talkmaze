"use client";
import SideBarBox from "./SideBarBox";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import type { NavItem } from "./types";

type Props = {
  /** Navigation entries to render, in order. The first item is the default
   *  active item when no link matches the current path. */
  navItems: NavItem[];
  /** Where the logo links to (e.g. "/student", "/coach"). */
  homeLink: string;
  isOpen: boolean;
  onToggle: () => void;
};

/**
 * Dashboard sidebar shared by the families and coach shells.
 *
 * Purely presentational + navigation chrome: the caller supplies the nav
 * config (including any live badge counts). On desktop (lg+) the sidebar is
 * always visible; on mobile/tablet (< lg) it renders as a fixed overlay that
 * slides in from the left.
 */
export default function SideBar({
  navItems,
  homeLink,
  isOpen,
  onToggle,
}: Props) {
  const pathname = usePathname();
  const fallbackId = navItems[0]?.id ?? 0;

  // The nav item whose link matches the current URL, derived during render.
  // .sort() so the longer URL is matched first before the shorter one - this
  // matters for nested routes: /parent/lessons should match over /parent.
  const match = [...navItems]
    .sort((a, b) => b.link.length - a.link.length)
    .find((item) => pathname.startsWith(item.link));
  const activeId = match ? match.id : fallbackId;

  return (
    <>
      {/* ========== Mobile sidebar (< lg) ======== */}
      {/* Backdrop - clicking outside closes the sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/*
        Sliding panel + pull-tab.
        --panel-w drives both the panel width and the closed-state translateX,
        keeping them in sync across breakpoints without duplicating values.
      */}
      <div
        className="fixed inset-y-0 left-0 z-50 flex flex-row lg:hidden transition-transform duration-300 ease-in-out [--panel-w:120px] sm:[--panel-w:160px]"
        style={{
          transform: isOpen
            ? "translateX(0)"
            : "translateX(calc(-1 * var(--panel-w)))",
        }}
      >
        {/* Sidebar panel - width comes from the CSS var, so it matches the
        closed sidebar translateX */}
        <div
          className="bg-[#2B4257] flex flex-col pt-[26px] px-2 overflow-hidden"
          style={{ width: "var(--panel-w)" }}
        >
          <Link
            href={homeLink}
            onClick={onToggle}
            className="self-center mb-4"
            aria-label="Go to home"
          >
            <Image
              src="/images/logos/talkmaze-logo-horizontal-inverse.svg"
              alt="Talk Maze Logo"
              width={80}
              height={36}
            />
          </Link>
          <nav className="flex flex-col gap-6">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.link}
                onClick={onToggle}
                className={`flex items-center gap-2 text-sm font-semibold pl-[7px] transition-colors
                  ${activeId === item.id ? "text-[#B1E7D6]" : "text-white hover:text-[#B1E7D6]"}`}
              >
                {item.icon}
                {item.name}
                {item.badge && item.badge > 0 ? (
                  <Badge
                    variant={item.badgeVariant ?? "primary"}
                    shape="circle"
                    size="md"
                    aria-label={`${item.name}: ${item.badge}`}
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {/* Pull tab - Show/Hide Mobile Sidebar*/}
        <button
          onClick={onToggle}
          className="self-center -ml-px w-7 h-32 bg-[#2B4257] rounded-tr-[15px] rounded-br-[15px] flex items-center justify-center cursor-pointer relative
            before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-2 before:w-11 before:h-11"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Image
            src="/images/icons/caret.png"
            alt=""
            width={14}
            height={13}
            className={`transition-transform duration-300 ${isOpen ? "" : "rotate-180"}`}
          />
        </button>
      </div>

      {/* ===== Desktop sidebar (lg+) ====== */}
      {/*
        pt-[23px] matches the navbar's md:pt-[23px], so:
        23px (pt) + 68px (logo wrapper) + 13px (mb) = 104px = navbar height
        
        This is so that the SideBar Nav items therefore always start at the 
        same Y as the dark container (main content area) top
      */}
      <div className="hidden lg:flex flex-col w-auto h-full pt-[23px] lg:px-[clamp(12px,1.5vw,24px)]">
        {/*
          Fixed-height Talkmaze logo wrapper
          logo scales inside but the 68px area never shrinks
        */}
        <div className="h-[68px] flex items-center justify-center mb-[13px]">
          <Link href={homeLink} aria-label="Go to home">
            <Image
              src="/images/logos/talkmaze-logo-horizontal-inverse.svg"
              alt="Talk Maze Logo"
              width={150}
              height={68}
              style={{ width: "clamp(100px, 10.5vw, 150px)", height: "auto" }}
            />
          </Link>
        </div>
        <nav className="flex flex-col gap-[18px]">
          {navItems.map((item) => (
            <SideBarBox
              key={item.id}
              id={item.id}
              name={item.name}
              state={activeId === item.id}
              link={item.link}
              icon={item.icon}
              badge={item.badge}
              badgeVariant={item.badgeVariant}
            />
          ))}
        </nav>
      </div>
    </>
  );
}
