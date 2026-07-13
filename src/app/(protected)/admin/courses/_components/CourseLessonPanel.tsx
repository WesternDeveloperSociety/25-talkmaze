"use client";

import { useEffect, useState } from "react";
import { Lesson, LessonInput } from "@/src/lib/lessons/types";
import { api, apiFetch } from "@/src/lib/api/routes";
import { createClient } from "@/src/services/supabase/client";
import { useRef } from "react";
import AssignStudentDropDown from "../../_components/AssignStudentDropDown";
import type { Student } from "../../_types";
import RichTextEditor from "@/src/components/common/rich-text/RichTextEditor";
interface CourseLessonsPanelProps {
  courseId: string;
  students: Student[];
}

const EMPTY_FORM: LessonInput = {
  title: "",
  description: "",
  content_url: "",
  pre_lesson_tasks: [],
  post_lesson_tasks: [],
  slide_show_input: [],
  slide_pptx_input: [],
};

export default function CourseLessonsPanel({
  courseId,
  students,
}: CourseLessonsPanelProps) {
  //references for file inputs
  const preTaskRef = useRef<HTMLInputElement | null>(null);
  const postTaskRef = useRef<HTMLInputElement | null>(null);
  const slidePdfRef = useRef<HTMLInputElement | null>(null);
  const slidePptxRef = useRef<HTMLInputElement | null>(null);
  const editPreTaskRef = useRef<HTMLInputElement | null>(null);
  const editPostTaskRef = useRef<HTMLInputElement | null>(null);
  const editSlidePdfRef = useRef<HTMLInputElement | null>(null);
  const editSlidePptxRef = useRef<HTMLInputElement | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Token icon state
  const [tokenByLesson, setTokenByLesson] = useState<
    Map<string, { id: string; icon_url: string | null }>
  >(new Map());
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(
    null,
  );
  const tokenIconRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<LessonInput>({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newPreTask, setNewPreTask] = useState<File | null>(null);
  const [newPostTask, setNewPostTask] = useState<File | null>(null);

  const [newSlidePdf, setNewSlidePdf] = useState<File | null>(null);
  const [newSlidePptx, setNewSlidePptx] = useState<File | null>(null);
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonInput>({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNewPreTask, setEditNewPreTask] = useState<File | null>(null);
  const [editNewPostTask, setEditNewPostTask] = useState<File | null>(null);
  const [editNewSlidePdf, setEditNewSlidePdf] = useState<File | null>(null);
  const [editNewSlidePptx, setEditNewSlidePptx] = useState<File | null>(null);
  const [editLessonOrder, setEditLessonOrder] = useState<Lesson[]>([]);
  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Rich-text descriptions for pre/post lesson tasks
  const [addPreDesc, setAddPreDesc] = useState("");
  const [addPostDesc, setAddPostDesc] = useState("");
  const [editPreDesc, setEditPreDesc] = useState("");
  const [editPostDesc, setEditPostDesc] = useState("");

  // Fetch token for each lesson whenever the lesson list changes
  useEffect(() => {
    if (lessons.length === 0) return;

    async function loadTokens() {
      const supabase = await createClient();
      const { data } = await supabase
        .from("tokens")
        .select("id, icon_url, lesson_id")
        .in(
          "lesson_id",
          lessons.map((l) => l.id),
        );

      const map = new Map<string, { id: string; icon_url: string | null }>();
      (data ?? []).forEach((t: any) => {
        if (t.lesson_id)
          map.set(t.lesson_id, { id: t.id, icon_url: t.icon_url });
      });
      setTokenByLesson(map);
    }

    loadTokens();
  }, [lessons]);

  async function handleTokenIconUpload(
    lessonId: string,
    file: File | undefined,
  ) {
    if (!file) return;

    if (file.type !== "image/png") {
      alert("Only PNG files are accepted.");
      return;
    }
    if (file.size > 512 * 1024) {
      alert("File must be under 512 KB.");
      return;
    }

    const token = tokenByLesson.get(lessonId);
    if (!token) return;

    setUploadingLessonId(lessonId);
    try {
      const supabase = await createClient();
      const path = `${token.id}.png`;

      const { error: uploadError } = await supabase.storage
        .from("token-icons")
        .upload(path, file, { upsert: true, contentType: "image/png" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("token-icons").getPublicUrl(path);

      await supabase
        .from("tokens")
        .update({ icon_url: publicUrl })
        .eq("id", token.id);

      setTokenByLesson((prev) => {
        const next = new Map(prev);
        next.set(lessonId, { ...token, icon_url: publicUrl });
        return next;
      });
    } catch (err) {
      console.error("Token icon upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploadingLessonId(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(api.courses.lessons(courseId))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.lessons)) setLessons(data.lessons);
        else setError(data?.error ?? "Failed to load lessons");
      })
      .catch(() => setError("Failed to load lessons"))
      .finally(() => setLoading(false));
  }, [courseId]);

  const addTaskToForm = (
    type:
      | "pre_lesson_tasks"
      | "post_lesson_tasks"
      | "slide_show_input"
      | "slide_pptx_input",
    value: File | null,
    setter: (value: File | null) => void,
    formSetter: React.Dispatch<React.SetStateAction<LessonInput>>,
  ) => {
    if (!value) return;
    formSetter((prev) => ({
      ...prev,
      [type]: [...(prev[type] ?? []), value],
    }));
    setter(null);
  };

  const removeTaskFromForm = (
    type:
      | "pre_lesson_tasks"
      | "post_lesson_tasks"
      | "slide_show_input"
      | "slide_pptx_input",
    index: number,
    formSetter: React.Dispatch<React.SetStateAction<LessonInput>>,
  ) => {
    formSetter((prev) => ({
      ...prev,
      [type]: (prev[type] ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleAdd = async () => {
    if (!addForm.title.trim()) {
      setAddError("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setAddError(null);

    try {
      const supabase = await createClient();
      const lesson_id = crypto.randomUUID();

      let preFileName = crypto.randomUUID();
      let postFileName = crypto.randomUUID();
      let slidePdfFileName = crypto.randomUUID();
      let slidePptxFileName = crypto.randomUUID();

      let preFileNameWithExt = "";
      let postFileNameWithExt = "";
      let slidePdfNameWithExt = "";
      let slidePptxNameWithExt = "";
      try {
        if (addForm.pre_lesson_tasks) {
          console.log("Adding pre lesson tasks");
          for (let i = 0; i < addForm.pre_lesson_tasks?.length; i++) {
            const file: File = addForm.pre_lesson_tasks[i];
            const fileExt = file.name.split(".").pop(); // get extension
            preFileNameWithExt = `${preFileName}.${fileExt}`;

            const filePath = `${courseId}/${lesson_id}/pre_lesson_tasks/${preFileNameWithExt}`;

            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("course_files")
                .upload(filePath, file);
            if (uploadError) {
              console.log(
                "Error uploading files to supabase storage: " + uploadError,
              );
              throw new Error("Upload Error: " + uploadError);
            }
          }
        }

        if (addForm.post_lesson_tasks) {
          console.log("adding post lesson tasks");
          for (let i = 0; i < addForm.post_lesson_tasks?.length; i++) {
            const file: File = addForm.post_lesson_tasks[i];
            const fileExt = file.name.split(".").pop(); // get extension
            postFileNameWithExt = `${postFileName}.${fileExt}`;
            const filePath = `${courseId}/${lesson_id}/post_lesson_tasks/${postFileNameWithExt}`;

            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("course_files")
                .upload(filePath, file);
            if (uploadError) {
              console.log(
                "Error uploading files to supabase storage: " + uploadError,
              );
              throw new Error("Upload Error: " + uploadError);
            }
          }

          console.log("Sucessfully uploaded post lesson tasks");
        }

        if (addForm.slide_show_input && addForm.slide_show_input.length > 0) {
          const file = addForm.slide_show_input[0];
          const fileExt = file.name.split(".").pop();
          slidePdfNameWithExt = `${slidePdfFileName}.${fileExt}`;
          const filePath = `${courseId}/${lesson_id}/lessons/${slidePdfNameWithExt}`;
          const { error: uploadError } = await supabase.storage
            .from("course_files")
            .upload(filePath, file);
          if (uploadError) throw new Error("Upload Error: " + uploadError);
        }

        if (addForm.slide_pptx_input && addForm.slide_pptx_input.length > 0) {
          const file = addForm.slide_pptx_input[0];
          const fileExt = file.name.split(".").pop();
          slidePptxNameWithExt = `${slidePptxFileName}.${fileExt}`;
          const filePath = `${courseId}/${lesson_id}/lessons/${slidePptxNameWithExt}`;
          const { error: uploadError } = await supabase.storage
            .from("course_files")
            .upload(filePath, file);
          if (uploadError) throw new Error("Upload Error: " + uploadError);
        }
      } catch (err) {
        console.log("Error writing to S3 bucket");
        throw new Error("Error writing to S3 Bucket");
      }

      const res = await apiFetch(api.courses.lessons(courseId), {
        method: "POST",
        json: {
          title: addForm.title,
          lesson_id: lesson_id,
          content_url: addForm.content_url,
          description: addForm.description,
          pre_file_name: preFileNameWithExt,
          post_file_name: postFileNameWithExt,
          slide_pdf_name: slidePdfNameWithExt,
          slide_pptx_name: slidePptxNameWithExt,
          pre_lesson_description: addPreDesc || null,
          post_lesson_description: addPostDesc || null,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");

      setLessons((prev) => [...prev, data?.lesson ?? data]);
      setAddForm({ ...EMPTY_FORM });
      setNewPreTask(null);
      setNewPostTask(null);
      setAddPreDesc("");
      setAddPostDesc("");
      setIsAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = async (lesson: Lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      title: lesson.title,
      description: lesson.description ?? "",
      content_url: lesson.content_url ?? "",
      pre_lesson_tasks: lesson.pre_lesson_tasks ?? null,
      post_lesson_tasks: lesson.post_lesson_tasks ?? null,
      slide_show_input: lesson.slide_show_input ?? null,
      slide_pptx_input: null,
    });
    setEditNewPreTask(null);
    setEditNewPostTask(null);
    setEditNewSlidePdf(null);
    setEditNewSlidePptx(null);
    setEditError(null);

    // Fetch admin-default task descriptions from lesson_tasks
    try {
      const supabase = await createClient();
      const { data: tasks } = await supabase
        .from("lesson_tasks")
        .select("type, description")
        .eq("lesson_id", lesson.id)
        .is("student_id", null);

      const preTask = (tasks ?? []).find((t: any) => t.type === "pre");
      const postTask = (tasks ?? []).find((t: any) => t.type === "post");
      setEditPreDesc(preTask?.description ?? "");
      setEditPostDesc(postTask?.description ?? "");
    } catch {
      setEditPreDesc("");
      setEditPostDesc("");
    }
  };

  const handleSave = async (lessonId: string) => {
    if (!editForm.title.trim()) {
      setEditError("Title is required.");
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const supabase = await createClient();
      const currentLesson = lessons.find((l) => l.id === lessonId);

      let preFileNameWithExt = "";
      let postFileNameWithExt = "";
      let slidePdfNameWithExt = "";
      let slidePptxNameWithExt = "";

      if (editNewPreTask) {
        const fileExt = editNewPreTask.name.split(".").pop();
        preFileNameWithExt = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("course_files")
          .upload(
            `${courseId}/${lessonId}/pre_lesson_tasks/${preFileNameWithExt}`,
            editNewPreTask,
          );
        if (uploadError)
          throw new Error("Upload Error: " + uploadError.message);
      }

      if (editNewPostTask) {
        const fileExt = editNewPostTask.name.split(".").pop();
        postFileNameWithExt = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("course_files")
          .upload(
            `${courseId}/${lessonId}/post_lesson_tasks/${postFileNameWithExt}`,
            editNewPostTask,
          );
        if (uploadError)
          throw new Error("Upload Error: " + uploadError.message);
      }

      if (editNewSlidePdf) {
        const fileExt = editNewSlidePdf.name.split(".").pop();
        slidePdfNameWithExt = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("course_files")
          .upload(
            `${courseId}/${lessonId}/lessons/${slidePdfNameWithExt}`,
            editNewSlidePdf,
          );
        if (uploadError)
          throw new Error("Upload Error: " + uploadError.message);
      }

      if (editNewSlidePptx) {
        const fileExt = editNewSlidePptx.name.split(".").pop();
        slidePptxNameWithExt = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("course_files")
          .upload(
            `${courseId}/${lessonId}/lessons/${slidePptxNameWithExt}`,
            editNewSlidePptx,
          );
        if (uploadError)
          throw new Error("Upload Error: " + uploadError.message);
      }

      const body: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description?.trim() || null,
        content_url: editForm.content_url?.trim() || null,
        pre_lesson_description: editPreDesc || null,
        post_lesson_description: editPostDesc || null,
      };
      if (preFileNameWithExt) body.pre_file_name = preFileNameWithExt;
      if (postFileNameWithExt) body.post_file_name = postFileNameWithExt;
      if (slidePdfNameWithExt) body.slide_pdf_name = slidePdfNameWithExt;
      if (slidePptxNameWithExt) body.slide_pptx_name = slidePptxNameWithExt;

      const res = await apiFetch(api.courses.lesson(courseId, lessonId), {
        method: "PATCH",
        json: body,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update lesson");

      const updatedLesson = data?.lesson ?? data;
      setLessons((prev) => prev.map((l) => (l.id === lessonId ? updatedLesson : l)));

      // Delete old slide storage files for any that were replaced
      // (pre/post task file cleanup is handled server-side by the PUT route)
      const staleStoragePaths: string[] = [
        slidePdfNameWithExt && currentLesson?.slide_show_url,
        slidePptxNameWithExt && currentLesson?.slide_pptx_url,
      ]
        .filter((p): p is string => Boolean(p))
        .map((p) => p.replace(/^course_files\//, ""));
      if (staleStoragePaths.length > 0) {
        await supabase.storage.from("course_files").remove(staleStoragePaths);
      }

      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (lessonId: string, title: string) => {
    if (!confirm(`Delete lesson "${title}"? This cannot be undone.`)) return;

    setDeletingId(lessonId);
    try {
      const res = await apiFetch(api.courses.lesson(courseId, lessonId), {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete lesson");
      }

      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      if (editingId === lessonId) setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting lesson");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Lessons</h3>
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true);
              setAddError(null);
              setAddForm({ ...EMPTY_FORM });
              setNewPreTask(null);
              setNewPostTask(null);
              setNewSlidePdf(null);
              setNewSlidePptx(null);
              setAddPreDesc("");
              setAddPostDesc("");
            }}
            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            + Add Lesson
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-3 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
          <p className="text-xs font-medium text-blue-800">New Lesson</p>

          {addError && (
            <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {addError}
            </p>
          )}

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addForm.title}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="e.g. Introduction to Algebra"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Description
            </label>
            <textarea
              value={addForm.description ?? ""}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={2}
              placeholder="Optional description..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Content URL
            </label>
            <input
              type="url"
              value={addForm.content_url ?? ""}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, content_url: e.target.value }))
              }
              placeholder="https://..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Pre-lesson tasks
            </label>
            <div className="flex gap-2">
              <input
                type="File"
                ref={preTaskRef}
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  addTaskToForm(
                    "pre_lesson_tasks",
                    e.target.files?.[0] ?? null,
                    setNewPreTask,
                    setAddForm,
                  );
                }}
                placeholder="Add a pre-lesson task"
                className="hidden"
              />
              <button
                type="button"
                onClick={(e) => preTaskRef.current?.click()}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Upload Files
              </button>
            </div>

            {(addForm.pre_lesson_tasks ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.pre_lesson_tasks &&
                  addForm.pre_lesson_tasks.map((task, idx) => (
                    <div
                      key={`${task}-${idx}`}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                    >
                      <span className="text-xs text-gray-800">{task.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          removeTaskFromForm(
                            "pre_lesson_tasks",
                            idx,
                            setAddForm,
                          )
                        }
                        className="text-[11px] text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Slide PDF upload */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Slide PDF{" "}
              <span className="text-gray-400">(rendered in viewer)</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={slidePdfRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  addTaskToForm(
                    "slide_show_input",
                    file,
                    setNewSlidePdf,
                    setAddForm,
                  );
                }}
                className="hidden"
              />
              <button
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                type="button"
                onClick={() => slidePdfRef.current?.click()}
              >
                Upload PDF
              </button>
            </div>
            {(addForm.slide_show_input ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.slide_show_input!.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                  >
                    <span className="text-xs text-gray-800">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeTaskFromForm("slide_show_input", idx, setAddForm)
                      }
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slide PPTX upload */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Slide PPTX <span className="text-gray-400">(archival)</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={slidePptxRef}
                type="file"
                accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  addTaskToForm(
                    "slide_pptx_input",
                    file,
                    setNewSlidePptx,
                    setAddForm,
                  );
                }}
                className="hidden"
              />
              <button
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                type="button"
                onClick={() => slidePptxRef.current?.click()}
              >
                Upload PPTX
              </button>
            </div>
            {(addForm.slide_pptx_input ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.slide_pptx_input!.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                  >
                    <span className="text-xs text-gray-800">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeTaskFromForm("slide_pptx_input", idx, setAddForm)
                      }
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Post-lesson tasks
            </label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                ref={postTaskRef}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  addTaskToForm(
                    "post_lesson_tasks",
                    e.target.files?.[0] ?? null,
                    setNewPostTask,
                    setAddForm,
                  );
                }}
                placeholder="Add a post-lesson task"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => postTaskRef.current?.click()}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Upload Files
              </button>
            </div>

            {(addForm.post_lesson_tasks ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.post_lesson_tasks &&
                  addForm.post_lesson_tasks.map((task, idx) => (
                    <div
                      key={`${task}-${idx}`}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                    >
                      <span className="text-xs text-gray-800">{task.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          removeTaskFromForm(
                            "post_lesson_tasks",
                            idx,
                            setAddForm,
                          )
                        }
                        className="text-[11px] text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <RichTextEditor
            title="Pre-Lesson Task Description"
            content={addPreDesc}
            onChange={setAddPreDesc}
          />

          <RichTextEditor
            title="Post-Lesson Task Description"
            content={addPostDesc}
            onChange={setAddPostDesc}
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={isSubmitting}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setAddError(null);
                setAddPreDesc("");
                setAddPostDesc("");
              }}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500 py-2">Loading lessons…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : lessons.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">
          No lessons yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            >
              {/**allow dragable  */}
              {editingId === lesson.id ? (
                <div className="p-3 space-y-2">
                  {editError && (
                    <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {editError}
                    </p>
                  )}

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, title: e.target.value }))
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">
                      Description
                    </label>
                    <textarea
                      value={editForm.description ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">
                      Content URL
                    </label>
                    <input
                      type="url"
                      value={editForm.content_url ?? ""}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          content_url: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Pre-lesson task
                    </label>
                    <input
                      ref={editPreTaskRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(e) =>
                        setEditNewPreTask(e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editPreTaskRef.current?.click()}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Replace File
                    </button>
                    {editNewPreTask && (
                      <div className="mt-2 flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1">
                        <span className="text-xs text-gray-800">
                          {editNewPreTask.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditNewPreTask(null)}
                          className="text-[11px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Post-lesson task
                    </label>
                    <input
                      ref={editPostTaskRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(e) =>
                        setEditNewPostTask(e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editPostTaskRef.current?.click()}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Replace File
                    </button>
                    {editNewPostTask && (
                      <div className="mt-2 flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1">
                        <span className="text-xs text-gray-800">
                          {editNewPostTask.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditNewPostTask(null)}
                          className="text-[11px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Slide PDF{" "}
                      <span className="text-gray-400">
                        (rendered in viewer)
                      </span>
                    </label>
                    <input
                      ref={editSlidePdfRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) =>
                        setEditNewSlidePdf(e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editSlidePdfRef.current?.click()}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Replace PDF
                    </button>
                    {editNewSlidePdf && (
                      <div className="mt-2 flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1">
                        <span className="text-xs text-gray-800">
                          {editNewSlidePdf.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditNewSlidePdf(null)}
                          className="text-[11px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Slide PPTX{" "}
                      <span className="text-gray-400">(archival)</span>
                    </label>
                    <input
                      ref={editSlidePptxRef}
                      type="file"
                      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(e) =>
                        setEditNewSlidePptx(e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editSlidePptxRef.current?.click()}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Replace PPTX
                    </button>
                    {editNewSlidePptx && (
                      <div className="mt-2 flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1">
                        <span className="text-xs text-gray-800">
                          {editNewSlidePptx.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditNewSlidePptx(null)}
                          className="text-[11px] text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <RichTextEditor
                    title="Pre-Lesson Task Description"
                    content={editPreDesc}
                    onChange={setEditPreDesc}
                  />

                  <RichTextEditor
                    title="Post-Lesson Task Description"
                    content={editPostDesc}
                    onChange={setEditPostDesc}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(lesson.id)}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditError(null);
                        setEditPreDesc("");
                        setEditPostDesc("");
                      }}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {lesson.title}
                    </p>

                    {lesson.description && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                        {lesson.description}
                      </p>
                    )}

                    {lesson.content_url && (
                      <a
                        href={lesson.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-blue-500 hover:underline mt-0.5 block truncate"
                      >
                        {lesson.content_url}
                      </a>
                    )}


                    {(lesson.slide_show_url || lesson.slide_pptx_url) && (
                      <div className="mt-2 flex gap-1">
                        {lesson.slide_show_url && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            PDF
                          </span>
                        )}
                        {lesson.slide_pptx_url && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            PPTX
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
                    {/* Token icon preview + upload */}
                    <div className="flex items-center gap-1 mr-1 border-r border-gray-200 pr-2">
                      {(() => {
                        const token = tokenByLesson.get(lesson.id);
                        const iconUrl = token?.icon_url ?? null;
                        return iconUrl?.startsWith("http") ? (
                          <img
                            src={iconUrl}
                            alt="Token"
                            className="w-6 h-6 object-contain rounded"
                          />
                        ) : (
                          <span className="text-base leading-none">
                            {iconUrl ?? "🧭"}
                          </span>
                        );
                      })()}
                      <input
                        type="file"
                        accept="image/png"
                        ref={(el) => {
                          tokenIconRefs.current[lesson.id] = el;
                        }}
                        onChange={(e) =>
                          handleTokenIconUpload(lesson.id, e.target.files?.[0])
                        }
                        className="hidden"
                      />
                      <button
                        type="button"
                        title="Upload token icon (PNG, max 512 KB)"
                        onClick={() =>
                          tokenIconRefs.current[lesson.id]?.click()
                        }
                        disabled={
                          uploadingLessonId === lesson.id ||
                          !tokenByLesson.has(lesson.id)
                        }
                        className="px-2 py-0.5 text-[11px] font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-40"
                      >
                        {uploadingLessonId === lesson.id ? "…" : "Icon"}
                      </button>
                    </div>
                    <button
                      onClick={() => startEdit(lesson)}
                      className="px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(lesson.id, lesson.title)}
                      disabled={deletingId === lesson.id}
                      className="px-2 py-0.5 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                    >
                      {deletingId === lesson.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div>
            <AssignStudentDropDown courseId={courseId} />
          </div>
        </div>
      )}
    </div>
  );
}
