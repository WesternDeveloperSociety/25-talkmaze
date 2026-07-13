"use client";

import { useState } from "react";
import { api, apiFetch } from "@/src/lib/api/routes";

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (course: { id: number; name: string; description?: string }) => void;
}

export default function CreateCourseModal({ isOpen, onClose, onSuccess }: CreateCourseModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName("");
    setDescription("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(api.courses.create(), {
        method: "POST",
        json: { course: { name: name.trim(), description: description.trim() || undefined } },
      });
      if (!response.ok) {
        const data = await response.json();
        console.log(data)
        throw new Error(data.error || "Failed to create course");
      }
      const created = await response.json();
      onSuccess(created?.course ?? created);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50" onClick={handleClose}>
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-md sm:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900">Create Course</h2>
          <button onClick={handleClose} className="w-11 h-11 md:w-auto md:h-auto flex items-center justify-center text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
              placeholder="e.g. Math Tutoring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
              placeholder="Optional description..."
            />
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={handleClose} className="min-h-[44px] md:min-h-0 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="min-h-[44px] md:min-h-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50">
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
        </div>
      </div>
    </div>
  );
}