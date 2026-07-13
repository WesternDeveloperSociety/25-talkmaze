"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import RichTextEditor from "@/src/components/common/rich-text/RichTextEditor";
import RichTextDisplay from "@/src/components/common/rich-text/RichTextDisplay";
import { Button } from "@/src/components/ui/button";
import { ExternalLinkIcon } from "@/src/components/ui/icons";
import { LESSON_STATUS_LABELS as STATUS_LABELS } from "@/src/lib/lessons/lessonStatus";
import { api, apiFetch } from "@/src/lib/api/routes";

const STATUS_STYLES: Record<number, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-green-100 text-green-700",
};

export interface TaskInfo {
  id: string;
  type: string;
  file_url: string | null;
  description: string | null;
  student_id: string | null;
}

export interface LessonInfo {
  title: string;
  description: string | null;
  courseName: string | null;
  slideshowUrl: string | null;
}

export interface LessonDetailClientProps {
  studentId: string;
  lessonId: string;
  courseId: string;
  studentName: string;
  lesson: LessonInfo;
  initialStatus: number;
  initialPositiveFeedback: string;
  initialImprovementFeedback: string;
  defaultPreTask: TaskInfo | null;
  defaultPostTask: TaskInfo | null;
  overridePreTask: TaskInfo | null;
  overridePostTask: TaskInfo | null;
}

/**
 * LessonDetailClient - interactive coach view for a single student lesson.
 *
 * Status changes are saved immediately on selection;
 * Feedback requires an explicit "Save" action.
 * Task overrides can be set per student (pre/post), overriding admin defaults.
 */
export default function LessonDetailClient({
  studentId,
  lessonId,
  courseId,
  studentName,
  lesson,
  initialStatus,
  initialPositiveFeedback,
  initialImprovementFeedback,
  defaultPreTask,
  defaultPostTask,
  overridePreTask,
  overridePostTask,
}: LessonDetailClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [positiveFeedback, setPositiveFeedback] = useState(
    initialPositiveFeedback,
  );
  const [improvementFeedback, setImprovementFeedback] = useState(
    initialImprovementFeedback,
  );
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Override task state
  const [preOverrideDesc, setPreOverrideDesc] = useState(
    overridePreTask?.description ?? "",
  );
  const [postOverrideDesc, setPostOverrideDesc] = useState(
    overridePostTask?.description ?? "",
  );
  const [preOverrideFile, setPreOverrideFile] = useState<File | null>(null);
  const [postOverrideFile, setPostOverrideFile] = useState<File | null>(null);
  const [clearPreFile, setClearPreFile] = useState(false);
  const [clearPostFile, setClearPostFile] = useState(false);
  const [savingPreOverride, setSavingPreOverride] = useState(false);
  const [savingPostOverride, setSavingPostOverride] = useState(false);
  const [preOverrideSaved, setPreOverrideSaved] = useState(false);
  const [postOverrideSaved, setPostOverrideSaved] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Current resolved override state (updated after save)
  const [currentOverridePre, setCurrentOverridePre] = useState(overridePreTask);
  const [currentOverridePost, setCurrentOverridePost] =
    useState(overridePostTask);

  const preFileRef = useRef<HTMLInputElement | null>(null);
  const postFileRef = useRef<HTMLInputElement | null>(null);

  /** Persists a status change immediately when coach changes the dropdown. */
  const handleStatusChange = async (newStatus: number) => {
    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await apiFetch(api.lessonProgress.root(), {
        method: "PATCH",
        json: {
          student_id: studentId,
          lesson_id: lessonId,
          status: newStatus,
        },
      });
      if (!res.ok) throw new Error("Failed to update status");
      setStatus(newStatus);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  /** Saves both feedback fields together. Shows a "Saved!" confirmation */
  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    setFeedbackSaved(false);
    setError(null);
    try {
      const res = await apiFetch(api.lessonProgress.feedback(), {
        method: "PATCH",
        json: {
          student_id: studentId,
          lesson_id: lessonId,
          positive_feedback: positiveFeedback,
          improvement_feedback: improvementFeedback,
        },
      });
      if (!res.ok) throw new Error("Failed to save feedback");
      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleResetOverride = async (type: "pre" | "post") => {
    const isPre = type === "pre";
    const setSaving = isPre ? setSavingPreOverride : setSavingPostOverride;
    const setSaved = isPre ? setPreOverrideSaved : setPostOverrideSaved;

    if (!confirm(`Reset ${type}-lesson task override to admin default?`))
      return;

    setSaving(true);
    setTaskError(null);
    try {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("lesson_id", lessonId);
      fd.append("course_id", courseId);
      fd.append("type", type);
      fd.append("description", "");
      fd.append("clear_file", "true");

      const res = await apiFetch(api.lessonTasks(), {
        method: "PATCH",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to reset override");
      }

      if (isPre) {
        setCurrentOverridePre(null);
        setPreOverrideDesc("");
        setPreOverrideFile(null);
        setClearPreFile(false);
      } else {
        setCurrentOverridePost(null);
        setPostOverrideDesc("");
        setPostOverrideFile(null);
        setClearPostFile(false);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setTaskError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverride = async (type: "pre" | "post") => {
    const isPre = type === "pre";
    const setSaving = isPre ? setSavingPreOverride : setSavingPostOverride;
    const setSaved = isPre ? setPreOverrideSaved : setPostOverrideSaved;
    const description = isPre ? preOverrideDesc : postOverrideDesc;
    const file = isPre ? preOverrideFile : postOverrideFile;
    const clearFile = isPre ? clearPreFile : clearPostFile;

    setSaving(true);
    setTaskError(null);
    try {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("lesson_id", lessonId);
      fd.append("course_id", courseId);
      fd.append("type", type);
      fd.append("description", description);
      if (file) fd.append("file", file);
      if (clearFile) fd.append("clear_file", "true");

      const res = await apiFetch(api.lessonTasks(), {
        method: "PATCH",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save override");
      }

      const saved = await res.json();

      const task = saved?.task ?? null;
      if (isPre) {
        setPreOverrideFile(null);
        setClearPreFile(false);
        if (saved?.deleted) {
          setCurrentOverridePre(null);
          setPreOverrideDesc("");
        } else {
          setCurrentOverridePre(task);
        }
      } else {
        setPostOverrideFile(null);
        setClearPostFile(false);
        if (saved?.deleted) {
          setCurrentOverridePost(null);
          setPostOverrideDesc("");
        } else {
          setCurrentOverridePost(task);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setTaskError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/coach/students/${studentId}/lessons`}
            className="inline-flex items-center gap-1.5 text-sm text-[#2B4257]/70 hover:text-[#2B4257] transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 5-7 7 7 7" />
            </svg>
            Back to Lessons
          </Link>
        </div>

        <div className="rounded-2xl bg-[#2B4257]/10 border border-[#2B4257]/15 px-6 py-5">
          <p className="text-sm font-medium text-[#2B4257]/60 mb-1">
            {studentName}
          </p>
          <h1 className="text-2xl font-bold text-[#2B4257]">{lesson.title}</h1>
          {lesson.courseName && (
            <p className="text-sm text-[#2B4257]/60 mt-1">
              Course: {lesson.courseName}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Lesson Details
          </h2>
          <div className="flex flex-col gap-4">
            {lesson.description && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {lesson.description}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <ResourceLink label="Slideshow" href={lesson.slideshowUrl} />
            </div>
          </div>
        </div>

        {/* Task Overrides */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Task Overrides
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            Set per-student task overrides below. These replace the admin
            defaults for this student only. Use "Reset to Default" to remove an
            override and revert to the admin default.
          </p>

          {taskError && (
            <p className="text-sm text-red-600 mb-4">{taskError}</p>
          )}

          {/* Pre-lesson task */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#2B4257] mb-3">
              Pre-Lesson Task
            </h3>

            {/* Admin default (read-only) */}
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Admin Default
              </p>
              <div className="flex flex-col gap-1">
                {defaultPreTask?.file_url ? (
                  <Button
                    asChild
                    variant="link"
                    className="h-auto gap-1 p-0 text-sm underline"
                  >
                    <a
                      href={defaultPreTask.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View file
                      <ExternalLinkIcon size={11} />
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-gray-400 italic">No file</span>
                )}
                {defaultPreTask?.description &&
                defaultPreTask.description !== "<p></p>" ? (
                  <RichTextDisplay
                    title=""
                    content={defaultPreTask.description}
                  />
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    No description
                  </span>
                )}
              </div>
            </div>

            {/* Coach override (editable) */}
            <div className="p-3 rounded-lg border border-[#2B4257]/20 bg-[#2B4257]/5">
              <p className="text-xs font-medium text-[#2B4257] mb-2">
                Override for {studentName}
              </p>

              {/* Current override file */}
              {currentOverridePre?.file_url && !clearPreFile && (
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    asChild
                    variant="link"
                    className="h-auto gap-1 p-0 text-sm underline"
                  >
                    <a
                      href={currentOverridePre.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Current file
                      <ExternalLinkIcon size={11} />
                    </a>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setClearPreFile(true)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              {clearPreFile && (
                <p className="text-xs text-amber-600 mb-2">
                  File will be removed on save.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setClearPreFile(false)}
                  >
                    Undo
                  </button>
                </p>
              )}

              {/* New file upload */}
              <div className="mb-3">
                <input
                  type="file"
                  ref={preFileRef}
                  accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(e) =>
                    setPreOverrideFile(e.target.files?.[0] ?? null)
                  }
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => preFileRef.current?.click()}
                  className="px-3 py-1 text-xs font-medium text-white bg-[#2B4257] hover:bg-[#2B4257]/80 rounded"
                >
                  {preOverrideFile ? "Change File" : "Upload Override File"}
                </button>
                {preOverrideFile && (
                  <span className="ml-2 text-xs text-gray-700">
                    {preOverrideFile.name}
                    <button
                      type="button"
                      className="ml-1 text-red-500 hover:text-red-700"
                      onClick={() => setPreOverrideFile(null)}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>

              <RichTextEditor
                title="Override Description"
                content={preOverrideDesc}
                onChange={setPreOverrideDesc}
              />

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  onClick={() => handleSaveOverride("pre")}
                  disabled={savingPreOverride}
                  className="px-4 py-2 rounded-lg bg-[#2B4257] text-white text-sm font-medium hover:bg-[#2B4257]/90 transition-colors disabled:opacity-50"
                >
                  {savingPreOverride ? "Saving…" : "Save Pre-Task Override"}
                </button>
                {currentOverridePre && (
                  <button
                    onClick={() => handleResetOverride("pre")}
                    disabled={savingPreOverride}
                    className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                )}
                {preOverrideSaved && (
                  <span className="text-sm text-green-600 font-medium">
                    Saved!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Post-lesson task */}
          <div>
            <h3 className="text-sm font-semibold text-[#2B4257] mb-3">
              Post-Lesson Task
            </h3>

            {/* Admin default (read-only) */}
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Admin Default
              </p>
              <div className="flex flex-col gap-1">
                {defaultPostTask?.file_url ? (
                  <Button
                    asChild
                    variant="link"
                    className="h-auto gap-1 p-0 text-sm underline"
                  >
                    <a
                      href={defaultPostTask.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View file
                      <ExternalLinkIcon size={11} />
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-gray-400 italic">No file</span>
                )}
                {defaultPostTask?.description &&
                defaultPostTask.description !== "<p></p>" ? (
                  <RichTextDisplay
                    title=""
                    content={defaultPostTask.description}
                  />
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    No description
                  </span>
                )}
              </div>
            </div>

            {/* Coach override (editable) */}
            <div className="p-3 rounded-lg border border-[#2B4257]/20 bg-[#2B4257]/5">
              <p className="text-xs font-medium text-[#2B4257] mb-2">
                Override for {studentName}
              </p>

              {currentOverridePost?.file_url && !clearPostFile && (
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    asChild
                    variant="link"
                    className="h-auto gap-1 p-0 text-sm underline"
                  >
                    <a
                      href={currentOverridePost.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Current file
                      <ExternalLinkIcon size={11} />
                    </a>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setClearPostFile(true)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              {clearPostFile && (
                <p className="text-xs text-amber-600 mb-2">
                  File will be removed on save.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setClearPostFile(false)}
                  >
                    Undo
                  </button>
                </p>
              )}

              <div className="mb-3">
                <input
                  type="file"
                  ref={postFileRef}
                  accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(e) =>
                    setPostOverrideFile(e.target.files?.[0] ?? null)
                  }
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => postFileRef.current?.click()}
                  className="px-3 py-1 text-xs font-medium text-white bg-[#2B4257] hover:bg-[#2B4257]/80 rounded"
                >
                  {postOverrideFile ? "Change File" : "Upload Override File"}
                </button>
                {postOverrideFile && (
                  <span className="ml-2 text-xs text-gray-700">
                    {postOverrideFile.name}
                    <button
                      type="button"
                      className="ml-1 text-red-500 hover:text-red-700"
                      onClick={() => setPostOverrideFile(null)}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>

              <RichTextEditor
                title="Override Description"
                content={postOverrideDesc}
                onChange={setPostOverrideDesc}
              />

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  onClick={() => handleSaveOverride("post")}
                  disabled={savingPostOverride}
                  className="px-4 py-2 rounded-lg bg-[#2B4257] text-white text-sm font-medium hover:bg-[#2B4257]/90 transition-colors disabled:opacity-50"
                >
                  {savingPostOverride ? "Saving…" : "Save Post-Task Override"}
                </button>
                {currentOverridePost && (
                  <button
                    onClick={() => handleResetOverride("post")}
                    disabled={savingPostOverride}
                    className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                )}
                {postOverrideSaved && (
                  <span className="text-sm text-green-600 font-medium">
                    Saved!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Progress Status
          </h2>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
            <select
              disabled={updatingStatus}
              value={status}
              onChange={(e) => handleStatusChange(Number(e.target.value))}
              className="border border-gray-200 rounded-lg text-sm py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-[#2B4257]/40 disabled:opacity-50"
            >
              <option value={1}>Not Started</option>
              <option value={2}>In Progress</option>
              <option value={3}>Completed</option>
            </select>
            {updatingStatus && (
              <div className="w-4 h-4 border-2 border-[#2B4257] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Coach Feedback
          </h2>
          <RichTextEditor
            title="Positive Feedback"
            content={positiveFeedback}
            onChange={setPositiveFeedback}
          />
          <RichTextEditor
            title="Areas of Improvement"
            content={improvementFeedback}
            onChange={setImprovementFeedback}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveFeedback}
              disabled={savingFeedback}
              className="px-5 py-2.5 rounded-lg bg-[#2B4257] text-white text-sm font-medium hover:bg-[#2B4257]/90 transition-colors disabled:opacity-50"
            >
              {savingFeedback ? "Saving…" : "Save Feedback"}
            </button>
            {feedbackSaved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Link to a lesson resource (slideshow, tasks, etc.) */
function ResourceLink({ label, href }: { label: string; href: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      {href ? (
        <Button
          asChild
          variant="link"
          className="h-auto gap-1 p-0 text-sm font-medium underline"
        >
          <a href={href} target="_blank" rel="noopener noreferrer">
            View
            <ExternalLinkIcon size={11} />
          </a>
        </Button>
      ) : (
        <span className="text-sm text-gray-400 italic">None</span>
      )}
    </div>
  );
}
