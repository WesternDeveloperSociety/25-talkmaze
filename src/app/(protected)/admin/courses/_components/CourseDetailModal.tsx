"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/src/services/supabase/client";
import { api, apiFetch } from "@/src/lib/api/routes";
import CourseLessonsPanel from "./CourseLessonPanel";
import type { Course } from "@/src/lib/lessons/types";
import type { Student } from "../../_types";

interface Props {
  course: Course;
  students: Student[];
  onClose: () => void;
  onUpdate: (updated: Course) => void;
  onDelete: () => void;
}

const inputClass =
  "mt-1 block w-full bg-[#2B4257] border border-white/10 text-white placeholder:text-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B1E7D6]/50 transition-colors";

const labelClass = "block text-[10px] font-semibold text-[#B1E7D6] uppercase tracking-widest mb-0.5";

export default function CourseDetailModal({ course, students, onClose, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Course>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [badge, setBadge] = useState<{ id: string; title: string; image_url: string | null } | null>(null);
  const [badgeTitle, setBadgeTitle] = useState("");
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const badgeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("badges")
      .select("id, title, image_url")
      .eq("course_id", String(course.id))
      .maybeSingle()
      .then(({ data }) => {
        setBadge(data ?? null);
        setBadgeTitle(data?.title ?? "");
      });
  }, [course.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch(api.courses.one(course.id), {
        method: "PATCH",
        json: { course: editForm },
      });
      if (!response.ok) throw new Error("Failed to update course");
      const updated = await response.json();
      onUpdate(updated?.course ?? updated);
      setIsEditing(false);
      setEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${course.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      const response = await apiFetch(api.courses.one(course.id), { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete course");
      onDelete();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBadgeUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "image/png") { alert("PNG only"); return; }
    setUploadingBadge(true);
    const supabase = createClient();
    let b = badge;
    if (!b) {
      const { data: newBadge } = await supabase
        .from("badges")
        .insert({ course_id: String(course.id), title: badgeTitle || course.name })
        .select("id, title, image_url")
        .single();
      b = newBadge;
    }
    if (!b) { setUploadingBadge(false); return; }
    const path = `${b.id}.png`;
    await supabase.storage.from("badges").upload(path, file, { upsert: true, contentType: "image/png" });
    const { data: { publicUrl } } = supabase.storage.from("badges").getPublicUrl(path);
    await supabase.from("badges").update({ image_url: publicUrl, title: badgeTitle || b.title }).eq("id", b.id);
    setBadge({ ...b, image_url: publicUrl, title: badgeTitle || b.title });
    setUploadingBadge(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-0 sm:p-4 z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1F2E3B] rounded-none sm:rounded-2xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1F2E3B] border-b border-white/10 px-6 py-4 flex flex-wrap justify-between items-center gap-2 rounded-t-2xl z-10">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-lg">
              {isEditing ? (editForm.name ?? course.name) : course.name}
            </h2>
            <p className="text-[#B1E7D6] text-xs opacity-60 mt-0.5">Course #{course.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => { setEditForm({ ...course }); setIsEditing(true); }}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#B1E7D6] hover:bg-[#9ed4c1] rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-lg"
                >
                  ×
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#65CFAD] hover:bg-[#50bfa0] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditForm({}); setIsEditing(false); }}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Course Info */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Course Information
            </h3>
            <div className="space-y-4">
              <div>
                <p className={labelClass}>Name</p>
                {isEditing ? (
                  <input type="text" value={editForm.name ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                ) : (
                  <p className="text-white font-medium text-sm">{course.name}</p>
                )}
              </div>
              <div>
                <p className={labelClass}>Description</p>
                {isEditing ? (
                  <textarea
                    value={editForm.description ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    rows={4}
                    className={inputClass + " resize-none"}
                  />
                ) : (
                  <p className="text-white/60 text-sm">{course.description || "—"}</p>
                )}
              </div>
            </div>
          </section>

          {/* Badge */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Course Badge
            </h3>
            <div className="flex items-center gap-4">
              {badge?.image_url ? (
                <img src={badge.image_url} className="w-16 h-16 object-contain rounded-xl border border-white/10 bg-[#2B4257]" alt="Badge" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#2B4257] border border-white/10 flex items-center justify-center text-white/20 text-xs">
                  None
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  value={badgeTitle}
                  onChange={(e) => setBadgeTitle(e.target.value)}
                  placeholder="Badge title"
                  className="bg-[#2B4257] border border-white/10 text-white placeholder:text-white/30 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#B1E7D6]/50 transition-colors w-48"
                />
                <input type="file" accept="image/png" ref={badgeInputRef} onChange={(e) => handleBadgeUpload(e.target.files?.[0])} className="hidden" />
                <button
                  onClick={() => badgeInputRef.current?.click()}
                  disabled={uploadingBadge}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20 rounded-lg transition-colors disabled:opacity-50 w-fit"
                >
                  {uploadingBadge ? "Uploading…" : badge ? "Replace image" : "Upload PNG"}
                </button>
              </div>
            </div>
          </section>

          {/* Lessons */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Lessons
            </h3>
            <CourseLessonsPanel students={students} courseId={String(course.id)} />
          </section>
        </div>
      </div>
    </div>
  );
}
