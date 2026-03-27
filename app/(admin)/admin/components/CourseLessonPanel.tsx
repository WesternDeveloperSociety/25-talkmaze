"use client";

import { useEffect, useState } from "react";
import { Lesson, LessonInput } from "@/lib/types/lesson";
import { createClient } from "@/utils/supabase/clientServer";
import { useRef } from "react";
import AssignStudentDropDown from "./AssignStudentDropDown";
import { TeachworksStudent } from "@/lib/teachworks/types";
import { Student } from "./AssignStudentDropDown";
interface CourseLessonsPanelProps {
  courseId: string;
  students: Student[]
}

const EMPTY_FORM: LessonInput = {
  title: "",
  description: "",
  content_url: "",
  pre_lesson_tasks: [],
  post_lesson_tasks: [],
  slide_show_input: []
};

export default function CourseLessonsPanel({ courseId, students }: CourseLessonsPanelProps) {
  

  //references for file inputs
  const preTaskRef = useRef<HTMLInputElement | null>(null)
  const postTaskRef = useRef<HTMLInputElement | null>(null)
  const slideShowRef = useRef<HTMLInputElement | null>(null)


  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<LessonInput>({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newPreTask, setNewPreTask] = useState<File | null>(null);
  const [newPostTask, setNewPostTask] = useState<File | null>(null);

  const [newSlideDeck, setNewSlideDeck] = useState<File | null>(null);
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonInput>({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNewPreTask, setEditNewPreTask] = useState<File | null>(null);
  const [editNewPostTask, setEditNewPostTask] = useState<File | null>(null);
  const [editNewSlideDeck, setEditNewSlideDeck] = useState<File|null>(null);
  
  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/courses/${courseId}/lessons`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLessons(data);
        else setError(data.error ?? "Failed to load lessons");
      })
      .catch(() => setError("Failed to load lessons"))
      .finally(() => setLoading(false));
  }, [courseId]);

  const addTaskToForm = (
    type: "pre_lesson_tasks" | "post_lesson_tasks" | "slide_show_input",
    value: File | null,
    setter: (value: File | null) => void,
    formSetter: React.Dispatch<React.SetStateAction<LessonInput>>
  ) => {
    
    if(!value) return;
    formSetter((prev) => ({
      ...prev,
      [type]: [...(prev[type] ?? []), value],
    }));
    setter(null);
  };



  const removeTaskFromForm = (
    type: "pre_lesson_tasks" | "post_lesson_tasks" | "slide_show_input",
    index: number,
    formSetter: React.Dispatch<React.SetStateAction<LessonInput>>
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
      let slideFileName = crypto.randomUUID()
      
      try{
        if(addForm.pre_lesson_tasks){
          console.log("Adding pre lesson tasks")
          for(let i = 0; i < addForm.pre_lesson_tasks?.length; i++){
            const file: File = addForm.pre_lesson_tasks[i];
            const fileExt = file.name.split(".").pop(); // get extension
            const fileName = `${preFileName}.${fileExt}`;
            const filePath = `${courseId}/${lesson_id}/pre_lesson_tasks/${fileName}`;

            const{data: uploadData, error: uploadError} = await supabase.storage
                  .from('course_files')
                  .upload(filePath,file)
              if(uploadError){
                  console.log("Error uploading files to supabase storage: " + uploadError);
                  throw new Error("Upload Error: " + uploadError);
              }
          }
        }

          
        if(addForm.post_lesson_tasks){
            console.log("adding post lesson tasks")
            for(let i = 0; i < addForm.post_lesson_tasks?.length; i++){
            const file: File = addForm.post_lesson_tasks[i];
            const fileExt = file.name.split(".").pop(); // get extension
            const fileName = `${postFileName}.${fileExt}`;
            const filePath = `${courseId}/${lesson_id}/post_lesson_tasks/${fileName}`;

            const{data: uploadData, error: uploadError} = await supabase.storage
                  .from('course_files')
                  .upload(filePath,file)
              if(uploadError){
                  console.log("Error uploading files to supabase storage: " + uploadError);
                  throw new Error("Upload Error: " + uploadError);
              }
          }

          console.log("Sucessfully uploaded post lesson tasks");
          
        }

          
        if(addForm.slide_show_input){
          console.log("Uploading slide shows")
          for(let i = 0; i < addForm.slide_show_input?.length; i++){
            const file: File = addForm.slide_show_input[i];
            const fileExt = file.name.split(".").pop(); // get extension
            const fileName = `${slideFileName}.${fileExt}`;
            const filePath = `${courseId}/${lesson_id}/lessons/${fileName}`;

            const{data: uploadData, error: uploadError} = await supabase.storage
                  .from('course_files')
                  .upload(filePath,file)
              if(uploadError){
                  console.log("Error uploading files to supabase storage: " + uploadError);
                  throw new Error("Upload Error: " + uploadError);
              }
          }

          console.log("Successfully uploaded slide show inputs")
        }
      }catch(err){
        console.log("Error writing to S3 bucket");
        throw new Error("Error writing to S3 Bucket")
      }


      
      
      
      const res = await fetch(`/api/admin/courses/${courseId}/lessons`, {
        method: "POST",
        body: JSON.stringify({
          title: addForm.title,
          lesson_id: lesson_id,
          content_url: addForm.content_url,
          description: addForm.description,
          pre_file_name: preFileName,
          post_file_name: postFileName,
          slide_file_name: slideFileName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");

      setLessons((prev) => [...prev, data]);
      setAddForm({ ...EMPTY_FORM });
      setNewPreTask(null);
      setNewPostTask(null);
      
      setIsAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      title: lesson.title,
      description: lesson.description ?? "",
      content_url: lesson.content_url ?? "",
      pre_lesson_tasks: lesson.pre_lesson_tasks ?? null,
      post_lesson_tasks: lesson.post_lesson_tasks ?? null,
      slide_show_input: lesson.slide_show_input ?? null
    });
    setEditNewPreTask(null);
    setEditNewPostTask(null);
    setEditNewSlideDeck(null);
    setEditError(null);
  };

  const handleSave = async (lessonId: string) => {
    console.log("Inside handle save");
    if (!editForm.title.trim()) {
      setEditError("Title is required.");
      return;
    }

    setIsSaving(true);
    setEditError(null);

    console.log("Pre lesson task before: " + editForm.pre_lesson_tasks)
    console.log("Post lesson task before: " + editForm.post_lesson_tasks)
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title.trim(),
            description: editForm.description?.trim() || null,
            content_url: editForm.content_url?.trim() || null,
            pre_lesson_tasks: editForm.pre_lesson_tasks ?? [],
            post_lesson_tasks: editForm.post_lesson_tasks ?? [],
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update lesson");

      setLessons((prev) => prev.map((l) => (l.id === lessonId ? data : l)));
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
      const res = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lessonId}`,
        { method: "DELETE" }
      );

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
              setEditNewSlideDeck(null);
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
            <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{addError}</p>
          )}

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addForm.title}
              onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Introduction to Algebra"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Description</label>
            <textarea
              value={addForm.description ?? ""}
              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">Content URL</label>
            <input
              type="url"
              value={addForm.content_url ?? ""}
              onChange={(e) => setAddForm((p) => ({ ...p, content_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Pre-lesson tasks</label>
            <div className="flex gap-2">
              <input
                type="File"
                ref={preTaskRef}
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e)  => {
                    const file = e.target.files?.[0] ?? null;
                    if(!file) return;
                    addTaskToForm("pre_lesson_tasks",e.target.files?.[0] ?? null,setNewPreTask,setAddForm)}
                  }
                placeholder="Add a pre-lesson task"
                className = 'hidden'
              />
              <button
                type = 'button'
                onClick = {(e) => preTaskRef.current?.click()}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Upload Files
              </button>
             
            </div>
            
                

            {(addForm.pre_lesson_tasks ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.pre_lesson_tasks && addForm.pre_lesson_tasks.map((task, idx) => (
                  <div
                    key={`${task}-${idx}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                  >
                    <span className="text-xs text-gray-800">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTaskFromForm("pre_lesson_tasks", idx, setAddForm)}
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>


            )}
          </div>

          {/**Let user add slideshows for lessons */}
             <div>
              <label className="block text-xs text-gray-600 mb-1">Add Slideshow</label>
              <div className="flex gap-2">
              <input
                ref={slideShowRef}
                type="file"
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e)  => {
                    const file = e.target.files?.[0] ?? null;
                    if(!file) return;
                    addTaskToForm("slide_show_input",e.target.files?.[0] ?? null,setNewSlideDeck,setAddForm)}
                  }
                placeholder="Add a pre-lesson task"
                className="hidden"
              />
              <button
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                type='button'
                 onClick={() =>
                  slideShowRef.current?.click()
                }
              >
                Upload Files
              </button>
              </div>

               {(addForm.slide_show_input ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.slide_show_input && addForm.slide_show_input.map((task, idx) => (
                  <div
                    key={`${task}-${idx}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                  > 
                    <span className="text-xs text-gray-800">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTaskFromForm("slide_show_input", idx, setAddForm)}
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
            <label className="block text-xs text-gray-600 mb-1">Post-lesson tasks</label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                ref={postTaskRef}
                onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if(!file) return;
                    addTaskToForm("post_lesson_tasks",e.target.files?.[0] ?? null,setNewPostTask,setAddForm)}
                  }
                placeholder="Add a post-lesson task"
                className="hidden"
              />
              <button
                type="button"
                onClick={() =>
                  postTaskRef.current?.click()
                }
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Upload Files
              </button>
            </div>

            {(addForm.post_lesson_tasks ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {addForm.post_lesson_tasks && addForm.post_lesson_tasks.map((task, idx) => (
                  <div
                    key={`${task}-${idx}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                  >
                    <span className="text-xs text-gray-800">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTaskFromForm("post_lesson_tasks", idx, setAddForm)}
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
        <p className="text-xs text-gray-400 italic py-2">No lessons yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            >
              {editingId === lesson.id ? (
                <div className="p-3 space-y-2">
                  {editError && (
                    <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{editError}</p>
                  )}

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">Description</label>
                    <textarea
                      value={editForm.description ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-0.5">Content URL</label>
                    <input
                      type="url"
                      value={editForm.content_url ?? ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, content_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Pre-lesson tasks</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        onChange={(e) => setEditNewPreTask(e.target.files?.[0] ?? null)}
                        placeholder="Add a pre-lesson task"
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          addTaskToForm(
                            "pre_lesson_tasks",
                            editNewPreTask,
                            setEditNewPreTask,
                            setEditForm
                          )
                        }
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Add
                      </button>
                    </div>

                    {(editForm.pre_lesson_tasks ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {editForm.pre_lesson_tasks && editForm.pre_lesson_tasks.map((task, idx) => (
                          <div
                            key={`${task}-${idx}`}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                          >
                            <span className="text-xs text-gray-800">{task.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeTaskFromForm("pre_lesson_tasks", idx, setEditForm)
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
                    <label className="block text-xs text-gray-600 mb-1">Post-lesson tasks</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        onChange={(e) => setEditNewPostTask(e.target.files?.[0] ?? null)}
                        placeholder="Add a post-lesson task"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          addTaskToForm(
                            "post_lesson_tasks",
                            editNewPostTask,
                            setEditNewPostTask,
                            setEditForm
                          )
                        }
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Add
                      </button>
                    </div>

                    {(editForm.post_lesson_tasks ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {editForm.post_lesson_tasks && editForm.post_lesson_tasks.map((task, idx) => (
                          <div
                            key={`${task}-${idx}`}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1"
                          >
                            <span className="text-xs text-gray-800">{task.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeTaskFromForm("post_lesson_tasks", idx, setEditForm)
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
                    <p className="text-xs font-semibold text-gray-900 truncate">{lesson.title}</p>

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

                    {(lesson.pre_lesson_tasks?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-medium text-gray-700">Pre-lesson tasks</p>
                        <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                          {lesson.pre_lesson_tasks && lesson.pre_lesson_tasks.map((task, i) => (
                            <li key={i} className="text-[11px] text-gray-500">
                              {task.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(lesson.post_lesson_tasks?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-medium text-gray-700">Post-lesson tasks</p>
                        <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                          {lesson.post_lesson_tasks && lesson.post_lesson_tasks.map((task, i) => (
                            <li key={i} className="text-[11px] text-gray-500">
                              {task.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
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