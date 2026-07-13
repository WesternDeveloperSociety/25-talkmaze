"use client";

import { useState, useEffect } from "react";
import type { Student } from "../../_types";
import { api, apiFetch } from "@/src/lib/api/routes";

interface Props {
  student: Student;
  onClose: () => void;
  onUpdate: (updated: Student) => void;
}

const inputClass =
  "mt-1 block w-full bg-[#2B4257] border border-white/10 text-white placeholder:text-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B1E7D6]/50 transition-colors";
const labelClass =
  "block text-[10px] font-semibold text-[#B1E7D6] uppercase tracking-widest mb-0.5";
const readonlyClass = "text-white/60 text-sm break-all";

function displayName(s: Student) {
  return [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
}

interface FieldProps {
  label: string;
  k: keyof Student;
  span?: string;
  isEditing: boolean;
  editForm: Partial<Student>;
  student: Student;
  onChange: (
    key: keyof Student,
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

function TextField({
  label,
  k,
  span,
  isEditing,
  editForm,
  student,
  onChange,
}: FieldProps) {
  return (
    <div className={span}>
      <p className={labelClass}>{label}</p>
      {isEditing ? (
        <input
          type="text"
          value={(editForm[k] as string) ?? ""}
          onChange={onChange(k)}
          className={inputClass}
        />
      ) : (
        <p className={readonlyClass}>{(student[k] as string) ?? "—"}</p>
      )}
    </div>
  );
}

function TextAreaField({
  label,
  k,
  isEditing,
  editForm,
  student,
  onChange,
}: FieldProps) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      {isEditing ? (
        <textarea
          rows={3}
          value={(editForm[k] as string) ?? ""}
          onChange={onChange(k)}
          className={inputClass + " resize-none"}
        />
      ) : (
        <p className={readonlyClass}>{(student[k] as string) ?? "—"}</p>
      )}
    </div>
  );
}

export default function StudentDetailModal({
  student,
  onClose,
  onUpdate,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleEditSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await apiFetch(api.students.one(student.id), {
        method: "PATCH",
        json: { student: editForm },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save changes");
      }
      onUpdate(data?.student ?? data);
      setIsEditing(false);
      setEditForm({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange =
    (key: keyof Student) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditForm((p) => ({ ...p, [key]: e.target.value || null }));

  const fieldProps = { isEditing, editForm, student, onChange: handleChange };

  const editingName = isEditing
    ? [editForm.first_name, editForm.last_name].filter(Boolean).join(" ") ||
      displayName(student)
    : displayName(student);

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
        <div className="sticky top-0 bg-[#1F2E3B] border-b border-white/10 px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h2 className="text-white font-bold text-lg">{editingName}</h2>
            <p className="text-[#B1E7D6] text-xs opacity-60 mt-0.5">
              Student profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditForm({ ...student });
                    setIsEditing(true);
                    setSaveError(null);
                  }}
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
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#65CFAD] hover:bg-[#50bfa0] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditForm({});
                    setIsEditing(false);
                    setSaveError(null);
                  }}
                  className="min-h-[44px] md:min-h-0 px-4 py-1.5 text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {saveError && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {saveError}
          </div>
        )}

        <div className="px-6 py-5 space-y-6">
          {/* IDs — always read-only */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Identity
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className={labelClass}>Student ID</p>
                <p className="text-white/50 font-mono break-all">
                  {student.id}
                </p>
              </div>
              <div>
                <p className={labelClass}>Account ID</p>
                <p className="text-white/50 font-mono break-all">
                  {student.account_id}
                </p>
              </div>
              <div>
                <p className={labelClass}>Created</p>
                <p className="text-white/50">
                  {student.created_at
                    ? new Date(student.created_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className={labelClass}>Updated</p>
                <p className="text-white/50">
                  {student.updated_at
                    ? new Date(student.updated_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Personal */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Personal
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="First Name" k="first_name" {...fieldProps} />
              <TextField label="Last Name" k="last_name" {...fieldProps} />
              <div>
                <p className={labelClass}>Date of Birth</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={(editForm.date_of_birth as string) ?? ""}
                    onChange={handleChange("date_of_birth")}
                    className={inputClass}
                  />
                ) : (
                  <p className={readonlyClass}>
                    {student.date_of_birth ?? "—"}
                  </p>
                )}
              </div>
              <TextField label="Grade" k="grade" {...fieldProps} />
              <TextField
                label="Location"
                k="location"
                span="col-span-2"
                {...fieldProps}
              />
              <div className="col-span-2">
                <TextAreaField label="Bio" k="bio" {...fieldProps} />
              </div>
            </div>
          </section>

          {/* Lesson Space */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Lesson Space
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Lesson Space ID"
                k="lesson_space_id"
                span="col-span-2"
                {...fieldProps}
              />
              <TextField
                label="Student Link"
                k="lesson_space_student_link"
                span="col-span-2"
                {...fieldProps}
              />
              <TextField
                label="Teacher Link"
                k="lesson_space_teacher_link"
                span="col-span-2"
                {...fieldProps}
              />
            </div>
          </section>

          {/* Settings */}
          <section>
            <h3 className="text-xs font-semibold text-[#B1E7D6] uppercase tracking-widest mb-3 pb-2 border-b border-white/5">
              Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={labelClass}>Post-Lesson Days</p>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    value={(editForm.post_lesson_days as number) ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        post_lesson_days:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={readonlyClass}>
                    {student.post_lesson_days ?? "—"}
                  </p>
                )}
              </div>
              <div>
                <p className={labelClass}>Post-Lesson Tasks</p>
                {isEditing ? (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        (editForm.post_lesson_tasks_enabled as boolean) ?? false
                      }
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          post_lesson_tasks_enabled: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded accent-[#B1E7D6]"
                    />
                    <span className="text-white/70 text-sm">Enabled</span>
                  </label>
                ) : (
                  <p className={readonlyClass}>
                    {student.post_lesson_tasks_enabled ? "Enabled" : "Disabled"}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <TextAreaField label="Notes" k="notes" {...fieldProps} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
