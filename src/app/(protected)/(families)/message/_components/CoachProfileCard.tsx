import { MapPin } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/src/components/ui/avatar";
import { initials } from "@/src/utils/formatName";

export type AssignedCoach = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  specialty: string | null;
};

type Props = {
  coach: AssignedCoach | null;
  /** When set (parent profile view), shows "Coach for: <name>" in the header. */
  forStudentName?: string | null;
};

/**
 * Sidebar card on /message that surfaces an assigned coach. Renders nothing
 * when there's no coach to show.
 */
export default function CoachProfileCard({ coach, forStudentName }: Props) {
  if (!coach) return null;

  const name =
    `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || "Your coach";

  return (
    <Card
      variant="light"
      padding="none"
      shadow="md"
      className="rounded-xl overflow-hidden"
    >
      <div className="relative z-10 flex justify-center items-start gap-6 bg-[#65CFAD] text-[#2b4257] px-6 pt-4 pb-2 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
        {/* Coach Avatar */}
        <Avatar
          size="lg"
          variant="navy"
          className="xl:size-18 2xl:size-20 shrink-0"
        >
          <AvatarImage src={coach.avatar_url} alt={name} sizes="80px" />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {coach.location && (
            <div className="flex items-center gap-1 text-xs">
              <MapPin size={22} className="text-[#2b4257] shrink-0" />
              <span className="truncate">{coach.location}</span>
            </div>
          )}
          <p className="font-bold truncate">{name}</p>
          {coach.specialty && (
            <p className="text-sm italic truncate">{coach.specialty}</p>
          )}
          {forStudentName && (
            <p className="text-xs text-[#1F2E3B] truncate mt-0.5">
              Coach for: <span className="font-semibold">{forStudentName}</span>
            </p>
          )}
        </div>
      </div>
      {/* Coach bio */}
      {coach.bio && (
        <div className="bg-white bg-[url('/images/backgrounds/shapes-pattern-bg.png')] bg-repeat px-6 py-3 max-h-35 overflow-y-auto">
          <p className="text-black text-xs leading-relaxed whitespace-pre-line">
            {coach.bio}
          </p>
        </div>
      )}
    </Card>
  );
}
