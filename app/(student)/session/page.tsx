import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────

type Session = {
  id: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  start_time: string; // ISO timestamp stored as 1970-01-01T…Z
  end_time: string;
  coach: { name: string } | null;
  student: { name: string } | null;
};

// ─── Constants ──────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Helpers ────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${period}`;
}

// ─── Data fetching ──────────────────────────────────────────────────────

async function getScheduleData(): Promise<{
  sessions: Session[];
  profileType: "student" | "parent";
  profileName: string;
}> {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const profileId = cookieStore.get("active_profile_id")?.value;
  const profileType = cookieStore.get("active_profile_type")?.value as
    | "student"
    | "parent"
    | undefined;

  if (!profileId || !profileType) redirect("/profiles");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (profileType === "student") {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, weekday, start_time, end_time, coaches:coach_id(name)")
      .eq("student_id", profileId)
      .order("weekday")
      .order("start_time");

    const { data: studentRow } = await supabase
      .from("students")
      .select("name")
      .eq("id", profileId)
      .single();

    return {
      sessions: (sessions ?? []).map((s: any) => ({
        ...s,
        coach: s.coaches ?? null,
        student: null,
      })),
      profileType,
      profileName: studentRow?.name ?? "Student",
    };
  } else {
    const { data: students } = await supabase
      .from("students")
      .select("id, name")
      .eq("account_id", user.id);

    const studentIds = (students ?? []).map((s: any) => s.id);

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, weekday, start_time, end_time, student_id, coaches:coach_id(name)")
      .in("student_id", studentIds.length ? studentIds : ["__none__"])
      .order("weekday")
      .order("start_time");

    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, s.name]));

    const { data: parentRow } = await supabase
      .from("parents")
      .select("name")
      .eq("id", profileId)
      .single();

    return {
      sessions: (sessions ?? []).map((s: any) => ({
        ...s,
        coach: s.coaches ?? null,
        student: { name: studentMap[s.student_id] ?? "Student" },
      })),
      profileType,
      profileName: parentRow?.name ?? "Parent",
    };
  }
}

// ─── Page ───────────────────────────────────────────────────────────────

export default async function SessionPage() {
  const { sessions, profileType, profileName } = await getScheduleData();

  const byDay: Record<number, Session[]> = sessions.reduce((acc, s) => {
    acc[s.weekday] = acc[s.weekday] ?? [];
    acc[s.weekday].push(s);
    return acc;
  }, {} as Record<number, Session[]>);

  const activeDays = DAYS.map((name, idx) => ({
    name,
    idx,
    sessions: byDay[idx] ?? [],
  })).filter((d) => d.sessions.length > 0);

  return (
    <div className="min-h-screen w-full bg-[#2b4257] font-[Roboto,sans-serif]">
\

      <main className="px-[clamp(16px,4vw,64px)] py-[clamp(24px,4vw,56px)]">
        {/* Title */}
        <div className="mb-[clamp(24px,3vw,40px)]">
          <h1 className="text-[clamp(22px,2vw,32px)] font-bold text-white leading-tight">Weekly Schedule</h1>
          <p className="text-white/50 text-sm mt-1">
            {profileType === "student"
              ? "Your upcoming coaching sessions"
              : "All student sessions across your account"}
          </p>
        </div>

        {/* No sessions */}
        {activeDays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <CalendarIcon />
            </div>
            <p className="text-white/40 text-sm font-medium">No sessions scheduled yet.</p>
            <Link
              href="/onboarding"
              className="mt-2 px-5 py-2 rounded-lg bg-[#65cfad] text-[#2b4257] text-sm font-semibold hover:bg-[#4fbf9a] transition-colors"
            >
              Add a profile
            </Link>
          </div>
        )}

        {/* Weekly grid */}
        {activeDays.length > 0 && (
          <div className="grid gap-[clamp(16px,2vw,28px)]">
            {activeDays.map(({ name, sessions: daySessions }) => (
              <div key={name} className="flex gap-[clamp(12px,2vw,24px)] items-start">
                <div className="w-[clamp(72px,7vw,100px)] flex-shrink-0 pt-[18px]">
                  <span className="text-[#65cfad] text-xs font-bold uppercase tracking-widest">
                    {name.slice(0, 3)}
                  </span>
                  <p className="text-white/30 text-[10px] mt-0.5">{name}</p>
                </div>

                <div className="flex flex-wrap gap-[clamp(10px,1.5vw,18px)] flex-1">
                  {daySessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      showStudent={profileType === "parent"}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full-week overview */}
        {activeDays.length > 0 && (
          <div className="mt-[clamp(32px,4vw,56px)]">
            <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">
              Full Week Overview
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day, idx) => {
                const count = byDay[idx]?.length ?? 0;
                return (
                  <div
                    key={day}
                    className={`rounded-xl p-3 text-center transition-colors ${
                      count > 0
                        ? "bg-[#65cfad]/15 border border-[#65cfad]/30"
                        : "bg-white/4 border border-white/8"
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${count > 0 ? "text-[#65cfad]" : "text-white/25"}`}>
                      {day.slice(0, 3)}
                    </p>
                    {count > 0 && <p className="text-white/70 text-[11px] mt-1">{count} session{count > 1 ? "s" : ""}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Session Card ───────────────────────────────────────────

function SessionCard({ session, showStudent }: { session: Session; showStudent: boolean }) {
  const start = fmtTime(session.start_time);
  const end = fmtTime(session.end_time);

  return (
    <div className="rounded-2xl bg-white/6 border border-white/10 px-[clamp(14px,1.5vw,22px)] py-[clamp(12px,1.2vw,18px)] min-w-[180px] flex flex-col gap-2 hover:bg-white/10 hover:border-[#65cfad]/40 transition-all duration-200">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-[#65cfad]/15 text-[#65cfad] text-xs font-semibold px-2.5 py-1 rounded-full">
          <ClockIcon />
          {start} – {end}
        </span>
      </div>

      {session.coach ? (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#65cfad] flex-shrink-0" />
          <p className="text-white/80 text-sm font-medium truncate">{session.coach.name}</p>
        </div>
      ) : (
        <p className="text-white/30 text-xs italic">Coach TBD</p>
      )}

      {showStudent && session.student && (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
          <p className="text-white/50 text-xs truncate">{session.student.name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}