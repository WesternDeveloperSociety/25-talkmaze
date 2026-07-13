import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

type InsertLessonInput = {
  course_id: string;
  lesson_id: string;
  title: string;
  description?: string | null;
  content_url?: string | null;
  pre_file_name?: string | null;
  post_file_name?: string | null;
  slide_pdf_name?: string | null;
  slide_pptx_name?: string | null;
  pre_lesson_description?: string | null;
  post_lesson_description?: string | null;
};

type InsertLessonResult =
  | { ok: true; lesson: LessonRow }
  | { ok: false; status: number; error: string };

/**
 * Insert a new lesson into a course at the tail of its linked list.
 *
 * Side effects (all run via individual SDK calls — NOT transactional; a
 * partial failure leaves the linked list inconsistent. See audit's
 * "compound mutations" note. Wrapping in a Postgres RPC is the canonical
 * fix and is tracked as a follow-up).
 *
 *   - INSERT lesson row
 *   - INSERT default lesson_tasks rows (pre/post) if descriptions/files given
 *   - INSERT token row (admin can upload icon afterwards)
 *   - Patch courses.head_lesson_id / tail_lesson_id pointers
 *   - Patch previous tail's next_lesson pointer
 *
 * Extracted from src/app/api/courses/[courseId]/lessons/route.ts per
 * api-contract.md §domain-logic-placement.
 */
export async function insertLessonIntoCourse(
  supabase: SupabaseClient<Database>,
  input: InsertLessonInput,
): Promise<InsertLessonResult> {
  const { course_id, lesson_id } = input;
  const title = input.title.trim();
  if (!title) {
    return { ok: false, status: 400, error: "Lesson title is required" };
  }

  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    lesson_id.slice(0, 8);

  const slide_show_url = input.slide_pdf_name
    ? `course_files/${course_id}/${lesson_id}/lessons/${input.slide_pdf_name}`
    : null;
  const slide_pptx_url = input.slide_pptx_name
    ? `course_files/${course_id}/${lesson_id}/lessons/${input.slide_pptx_name}`
    : null;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      id: lesson_id,
      course_id,
      title,
      slug,
      description: input.description?.trim() || null,
      content_url: input.content_url?.trim() || null,
      slide_show_url,
      slide_pptx_url,
    })
    .select()
    .single();

  if (error || !lesson) {
    console.error("insertLessonIntoCourse: lesson insert failed", error);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  // Default lesson_tasks rows (student_id = null = admin default).
  const preFileUrl = input.pre_file_name
    ? `course_files/${course_id}/${lesson_id}/pre_lesson_tasks/${input.pre_file_name}`
    : null;
  const postFileUrl = input.post_file_name
    ? `course_files/${course_id}/${lesson_id}/post_lesson_tasks/${input.post_file_name}`
    : null;

  if (preFileUrl || input.pre_lesson_description) {
    await supabase.from("lesson_tasks").insert({
      lesson_id,
      student_id: null,
      type: "pre",
      file_url: preFileUrl,
      description: input.pre_lesson_description || null,
    });
  }
  if (postFileUrl || input.post_lesson_description) {
    await supabase.from("lesson_tasks").insert({
      lesson_id,
      student_id: null,
      type: "post",
      file_url: postFileUrl,
      description: input.post_lesson_description || null,
    });
  }

  // Token row so the admin can upload an icon right after creation.
  await supabase.from("tokens").insert({
    lesson_id,
    title,
    code: lesson_id.slice(0, 8).toUpperCase(),
  });

  // Linked-list pointer maintenance.
  const { data: course } = await supabase
    .from("courses")
    .select("head_lesson_id, tail_lesson_id")
    .eq("id", course_id)
    .maybeSingle();

  if (!course) {
    // Lesson was inserted but the course is gone. Return the lesson rather
    // than rolling back (which we can't without RPC) — the caller can
    // surface this as a warning.
    return { ok: true, lesson };
  }

  if (course.head_lesson_id == null) {
    await supabase
      .from("courses")
      .update({ head_lesson_id: lesson_id, tail_lesson_id: lesson_id })
      .eq("id", course_id);
  } else if (course.tail_lesson_id) {
    await supabase
      .from("courses")
      .update({ tail_lesson_id: lesson_id })
      .eq("id", course_id);
    await supabase
      .from("lessons")
      .update({ prev_lesson: course.tail_lesson_id })
      .eq("id", lesson_id);
    await supabase
      .from("lessons")
      .update({ next_lesson: lesson_id })
      .eq("id", course.tail_lesson_id);
  }

  return { ok: true, lesson };
}
