import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";

/**
 * PATCH /api/lesson-tasks
 *
 * Upserts (or deletes) a coach-set per-student override for a lesson's
 * pre/post task. Multipart form data.
 *
 * Logic:
 *   - If description is empty and no file remains, the override row is
 *     deleted → student falls back to admin default.
 *   - Otherwise, uploads the file (if any) and upserts the lesson_tasks row.
 *
 * Note: file uploads + storage deletes use the user-scoped supabase client
 * (the route is admin-only via `requireRole([2])` + ownership check). The
 * previous service-role storage client has been removed per the contract's
 * webhook-only rule (api-contract.md §service-role escape hatch).
 */

const FormSchema = z
  .object({
    student_id: z.string().uuid(),
    lesson_id: z.string().uuid(),
    course_id: z.string().uuid(),
    type: z.enum(["pre", "post"]),
    description: z.string().optional(),
    clear_file: z.enum(["true", "false"]).optional(),
  });

export async function PATCH(request: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE — read multipart FormData and validate scalar fields.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const scalarFields = {
    student_id: formData.get("student_id"),
    lesson_id: formData.get("lesson_id"),
    course_id: formData.get("course_id"),
    type: formData.get("type"),
    description: formData.get("description") ?? undefined,
    clear_file: formData.get("clear_file") ?? undefined,
  };

  const parsed = FormSchema.safeParse(scalarFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { student_id, lesson_id, course_id, type } = parsed.data;
  const description = parsed.data.description ?? "";
  const clearFile = parsed.data.clear_file === "true";
  const file = formData.get("file");
  const fileBlob = file instanceof File && file.size > 0 ? file : null;

  // Stage 3: AUTHORIZE
  const ownership = await assertCoachAssignedToStudent(auth, student_id);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    const { data: existing } = await supabase
      .from("lesson_tasks")
      .select("id, file_url")
      .eq("lesson_id", lesson_id)
      .eq("student_id", student_id)
      .eq("type", type)
      .maybeSingle();

    const descriptionIsEmpty = !description || description === "<p></p>";
    const keepExistingFile = !fileBlob && !clearFile && existing?.file_url;

    // Delete branch: description empty + no file remains.
    if (descriptionIsEmpty && !fileBlob && !keepExistingFile) {
      if (existing) {
        if (existing.file_url) {
          const oldPath = existing.file_url.replace(/^course_files\//, "");
          await supabase.storage.from("course_files").remove([oldPath]);
        }
        await supabase.from("lesson_tasks").delete().eq("id", existing.id);
      }
      return NextResponse.json({ deleted: true });
    }

    // Upload new file if provided.
    let newFileUrl: string | null = existing?.file_url ?? null;

    if (fileBlob) {
      const fileExt = fileBlob.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const taskFolder = type === "pre" ? "pre_lesson_tasks" : "post_lesson_tasks";
      const filePath = `${course_id}/${lesson_id}/student_overrides/${student_id}/${taskFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("course_files")
        .upload(filePath, fileBlob);

      if (uploadError) {
        console.error("lesson-tasks PATCH upload error", uploadError);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      if (
        existing?.file_url &&
        existing.file_url !== `course_files/${filePath}`
      ) {
        const oldPath = existing.file_url.replace(/^course_files\//, "");
        await supabase.storage.from("course_files").remove([oldPath]);
      }

      newFileUrl = `course_files/${filePath}`;
    } else if (clearFile && existing?.file_url) {
      const oldPath = existing.file_url.replace(/^course_files\//, "");
      await supabase.storage.from("course_files").remove([oldPath]);
      newFileUrl = null;
    }

    const upsertPayload = {
      lesson_id,
      student_id,
      type,
      file_url: newFileUrl,
      description: descriptionIsEmpty ? null : description,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("lesson_tasks")
        .update(upsertPayload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        console.error("lesson-tasks PATCH update error", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from("lesson_tasks")
        .insert(upsertPayload)
        .select()
        .single();
      if (error) {
        console.error("lesson-tasks PATCH insert error", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
      result = data;
    }

    return NextResponse.json({ task: result });
  } catch (err: unknown) {
    console.error("lesson-tasks PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
