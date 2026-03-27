import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ProfileCard from "../components/profiles/ProfileCard";
import ManageProfilesButton from "../components/profiles/ManageProfilesButton";
import { selectProfile } from "@/lib/profile-management/selectProfile";
import { getCurrentUser } from "@/utils/supabase/lib/getCurrentUser";

// Profile to select as the "active profile"
type Profile = {
  id: string;
  name: string;
  type: "student" | "parent";
  hasPin: boolean;
};

/**
 * Fetches all profiles associated with the current user's account.
 * Redirects to login if user is not authenticated.
 * @returns Array of Profile objects for selection
 */


async function getProfiles(): Promise<Profile[]> {

  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login"); // Redirect to login if not authenticated

  // Fetch parent and student profiles in parrallel
  const [{ data: parents }, { data: students }] = await Promise.all([
    supabase
      .from("parents")
      .select("id, name, profile_access_pin")
      .eq("account_id", user.id),
    supabase
      .from("students")
      .select("id, name, profile_access_pin")
      .eq("account_id", user.id),
  ]);

  console.log("Retrieved parents: " + JSON.stringify(parents));
  console.log("Retrieved Students: " + JSON.stringify(students))

  // Combine and return parent and student profiles
  return [
    ...(parents ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: "parent" as const,
      hasPin: p.profile_access_pin != null,
    })),
    ...(students ?? []).map((s) => ({
      id: s.id,
      name: s.name ?? "Unnamed",
      type: "student" as const,
      hasPin: false, // Students no longer have PINs
    })),
  ];
}

/**
 * Profile selection top-level page component.
 * Allows the user to select a parent or student profile, displays errors, and
 * provides link to add a new profile
 */
export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {

  
  const profiles = await getProfiles();
  const { error } = await searchParams;

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen w-full bg-[#2b4257] font-[Roboto,sans-serif]">
      <header className="absolute left-[clamp(16px,1.5vw,24px)] top-[clamp(15px,2vw,30px)] flex items-center gap-1">
        <img
          src="/talkmaze-logo.png"
          alt="TalkMaze Logo"
          className="w-[clamp(36px,3.4vw,52px)] h-[clamp(36px,3.4vw,52px)] object-contain"
        />
        <span className="text-[clamp(16px,1.3vw,20px)] font-semibold">
          <span className="text-[#65cfad]">Talk</span>
          <span className="text-white">Maze</span>
        </span>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-[clamp(18px,1.6vw,24px)] font-bold text-white mb-[clamp(48px,8vw,120px)]">
          Select Your Profile: Parent or Student
        </h1>

        {/* Display error messages here */}
        {error === "wrong_pin" && (
          <p className="text-red-400 text-sm mb-6 font-medium">
            Incorrect PIN. Please try again.
          </p>
        )}
        {error === "not_found" && (
          <p className="text-red-400 text-sm mb-6 font-medium">
            Profile not found. Please try again.
          </p>
        )}

        {/* Profile selection */}
        <div className="flex items-start justify-center gap-[clamp(24px,4vw,60px)] flex-wrap">
          {profiles.map((profile) => {
            const isParentWithoutPin = profile.type === "parent" && !profile.hasPin;

            if (isParentWithoutPin) {
              return (
                <a
                  key={profile.id}
                  href={`/api/profiles/select?profileId=${profile.id}&profileType=parent`}
                  className="no-underline"
                >
                  <ProfileCard
                    id={profile.id}
                    name={profile.name}
                    imageUrl="/meera-profile.png"
                    hasPin={false}
                    asLink={true}
                  />
                </a>
              );
            }

            return (
              <form key={profile.id} action={selectProfile}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="profileType" value={profile.type} />
                <ProfileCard
                  id={profile.id}
                  name={profile.name}
                  imageUrl={
                    profile.type === "student"
                      ? "/priya-profile.png"
                      : "/meera-profile.png"
                  }
                  hasPin={profile.hasPin}
                />
              </form>
            );
          })}

          
          <div className="flex flex-col items-center">
            <a
              href="/onboarding"
              className="flex flex-col items-center gap-[clamp(12px,1.3vw,20px)] cursor-pointer group"
            >
              <div className="w-[clamp(140px,14vw,200px)] aspect-square rounded-xl bg-[#b1e7d6] border-[0.5px] border-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center mix-blend-color-dodge">
                  <img
                    src="/lock-icon.svg"
                    alt=""
                    className="w-[75%] h-[75%] object-contain"
                  />
                </div>
                <div className="absolute inset-0 shadow-[inset_0px_4px_4px_0px_rgba(0,0,0,0.25)] rounded-xl pointer-events-none" />
              </div>
              <span className="text-[clamp(16px,1.5vw,22px)] font-bold text-white" >
                + add profile
              </span>
            </a>
            <div className="h-[clamp(40px,4vw,60px)]" />
          </div> 
        </div>

        {/* Manage Profiles Button */}
        {/*<ManageProfilesButton />*/}
      </main>
    </div>
  );
}


