import type { Database } from "@/src/services/supabase/types/database";

type Course = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "created_at"
>;

export interface CoachCourseListItem extends Course {
  assignment: {
    id: string;
    isActive: boolean;
    assigned_at: string;
    progress: number;
  } | null;
}
