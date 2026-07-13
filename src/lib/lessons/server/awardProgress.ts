import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type LessonProgressRow =
  Database["public"]["Tables"]["lesson_progress"]["Row"];

type AwardProgressResult =
  | { ok: true; row: LessonProgressRow }
  | { ok: false; status: number; error: string };

/**
 * Record a coach's lesson-progress update for a student and cascade the
 * derived state:
 *
 *   - lesson_progress: upsert the row, set completed_at when status=3.
 *   - student_tokens: when a token exists for the lesson, add on status=3,
 *     remove otherwise.
 *   - student_badges: when the lesson's course has a badge AND every lesson
 *     in the course is now status=3, award the badge. Reverting any lesson
 *     out of status=3 removes the badge.
 *
 * Extracted from src/app/api/lesson-progress/route.ts — the route now
 * just authenticates, validates, asserts ownership, and delegates here.
 */
export async function awardProgress(
  supabase: SupabaseClient<Database>,
  input: { student_id: string; lesson_id: string; status: 1 | 2 | 3 },
): Promise<AwardProgressResult> {
  const { student_id, lesson_id, status } = input;
  const now = new Date().toISOString();

  // 1. Upsert lesson_progress (primary write).
  const { data: row, error: upsertError } = await supabase
    .from("lesson_progress")
    .upsert(
      {
        student_id,
        lesson_id,
        status,
        completed_at: status === 3 ? now : null,
        updated_at: now,
      },
      { onConflict: "student_id,lesson_id" },
    )
    .select()
    .single();

  if (upsertError || !row) {
    return { ok: false, status: 500, error: "Internal server error" };
  }

  // 2. Token cascade: if this lesson has a token, add or remove the
  //    student_tokens row based on whether status is "done".
  const { data: token } = await supabase
    .from("tokens")
    .select("id")
    .eq("lesson_id", lesson_id)
    .maybeSingle();

  if (token) {
    if (status === 3) {
      await supabase.from("student_tokens").upsert(
        { student_id, token_id: token.id, awarded_at: now },
        { onConflict: "student_id,token_id" },
      );
    } else {
      await supabase
        .from("student_tokens")
        .delete()
        .eq("student_id", student_id)
        .eq("token_id", token.id);
    }
  }

  // 3. Badge cascade: if the lesson's course has a badge AND every lesson
  //    in the course is status=3, award it. Reverting any lesson out of
  //    status=3 removes the badge.
  const { data: lessonRow } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", lesson_id)
    .maybeSingle();

  const courseId = lessonRow?.course_id;
  if (courseId) {
    const { data: badge } = await supabase
      .from("badges")
      .select("id")
      .eq("course_id", courseId)
      .maybeSingle();

    if (badge) {
      if (status === 3) {
        const [{ data: allLessons }, { data: completedRows }] =
          await Promise.all([
            supabase.from("lessons").select("id").eq("course_id", courseId),
            supabase
              .from("lesson_progress")
              .select("lesson_id")
              .eq("student_id", student_id)
              .eq("status", 3),
          ]);
        const completedIds = new Set(
          (completedRows ?? []).map((r) => r.lesson_id),
        );
        const allDone = (allLessons ?? []).every((l) =>
          completedIds.has(l.id),
        );
        if (allDone) {
          await supabase.from("student_badges").upsert(
            { student_id, badge_id: badge.id, awarded_at: now },
            { onConflict: "student_id,badge_id" },
          );
        }
      } else {
        await supabase
          .from("student_badges")
          .delete()
          .eq("student_id", student_id)
          .eq("badge_id", badge.id);
      }
    }
  }

  return { ok: true, row };
}
