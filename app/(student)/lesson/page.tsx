"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { createClient } from "@/utils/supabase/client";

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  content_url: string | null;
  pre_lesson_url: string | null;
  post_lesson_url: string | null;
  slide_show_input: string | null;
  created_at: string;
};

type BadgeRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon_url: string | null;
};

const LESSON_ICONS = ["🧭", "🔭", "⭐️", "🏹", "🍍", "🗺️", "🐚", "🥥", "👓", "📚"];

const BADGES_DISPLAY_LIMIT = 7;
const BADGES_GAP_PX = 8;
const BADGES_MIN_SIZE_PX = 20;
const BADGES_MAX_SIZE_PX = 42;

export default function Page() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonRow | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const[preLessonTasks, setPreLessonTasks] = useState<string| null>(null);
  const[postLessonTasks, setPostLessonTasks] = useState<string| null>(null);
  const [slideShow, setSlideShow] = useState<string | undefined>("");
  useEffect(() => {
    async function fetchLessons() {
      const supabase = createClient();
      const {data: {user}} = await supabase.auth.getUser();

      if(!user){
        throw new Error("Can not identify user");
      }

      //get the student
      const {data: student, error: studentError} = await supabase.from('students').select('id').eq("account_id", user.id).single();

      if(!student){
        throw new Error("Can not identify student: " + JSON.stringify(studentError));
      } 
      //first get the course
      const{data: course, error: courseError} = await supabase.from('course_assignment').select('course_id').eq("student_id", student.id).limit(1).single();

      //fetch the lessons of the course
      if(!course){
        throw new Error("Can not find the user's course: " + JSON.stringify(courseError));
      }

    
      const{data: lessons, error: lessonsError} = await supabase.from('lessons').select('id, course_id , created_at, pre_lesson_url, post_lesson_url, slide_show_url, content_url, description, title').eq('course_id',course.course_id);
     
      if(lessonsError){
        console.log("Lesson error: " + JSON.stringify(lessonsError));
      }
      setLessons(lessons ?? []);

      setLoading(false);
    }

    fetchLessons();
    
  }, []);

  useEffect(() => {
    if (lessons.length === 0) return;

    async function fetchProgress() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProgress({ completed: 0, total: lessons.length });
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const studentId = student?.id;
      const total = lessons.length;

      if (!studentId) {
        setProgress({ completed: 0, total });
        return;
      }

      const { data: progressRows } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("student_id", studentId);

      const completedRows = (progressRows ?? []).filter(
        (row) => row.status === "Done" || row.status === 1
      );
      const completed = completedRows.length;
      
      // Store completed lesson IDs for individual lesson status
      const completedIds = new Set(completedRows.map(row => row.lesson_id));
      setCompletedLessonIds(completedIds);
      
      setProgress({ completed, total });
    }
    fetchProgress();
  }, [lessons]);

  useEffect(() => {
    async function fetchBadges() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("badges")
        .select("id, code, title, description, icon_url")
        .order("code", { ascending: true });

      if (!error) setBadges(data ?? []);
    }
    fetchBadges();
  }, []);

  const handleBackClick = useCallback(() => {
    setSelectedLesson(null);
  }, []);


  async function handleLessonClick(lesson: LessonRow){
    console.log("Inside handleLessonClick")
    setSelectedLesson(lesson);
    const supabase = await createClient();
   
    try{
      //fetch tasks
      if(lesson.pre_lesson_url){
        const cleanPath = lesson.pre_lesson_url.replace(/^course_files\//, "");


       
console.log("Folder path: " + JSON.stringify(cleanPath));
       
        const { data:filesPre} = await supabase.storage
        .from("course_files")
        .getPublicUrl(`${cleanPath}.pdf`)
        
        console.log("Files" + filesPre);
        console.log("Files JSON:", JSON.stringify(filesPre, null, 2));
        console.log("Error"+error);
       
       setPreLessonTasks(filesPre.publicUrl)
       
        
      }
      if(lesson.post_lesson_url){
        
          const cleanPath2 = lesson.post_lesson_url.replace(/^course_files\//, "");
        
        const {data: filesPost} = await supabase.storage
        .from("course_files")
        .getPublicUrl(`${cleanPath2}.pdf`)
        setPostLessonTasks(filesPost.publicUrl)
      }

      if(lesson.slide_show_input){
            const cleanPath3 = lesson.slide_show_input.replace(/^course_files\//, "");
             const {data: filesSlide} = await supabase.storage
            .from("course_files")
            .getPublicUrl(`${cleanPath3}.ppt`)

            setSlideShow(filesSlide.publicUrl);
             

      }
    }catch(err){

    }
  }
 

  const lessonCardsData = useMemo(() => {
    console.log("Mapping lessons: " + JSON.stringify(lessons[0]));
    return lessons.map((lesson, index) => ({
      lesson,
      lessonNumber: index + 1,
      icon: LESSON_ICONS[index % LESSON_ICONS.length],
      isCompleted: completedLessonIds.has(lesson.id),
      onClick: () => handleLessonClick(lesson),
    }));
  }, [lessons, completedLessonIds, handleLessonClick]);

  if (loading) {
    return (
      <div className="w-full max-w-[1400px] p-6 md:p-12 flex flex-col gap-8 mx-auto text-white">
        <div className="flex items-center justify-center min-h-[200px] text-[#B1E7D6]">Loading lessons...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[1400px] p-6 md:p-12 flex flex-col gap-8 mx-auto text-white">
        <div className="rounded-2xl bg-red-500/20 text-red-200 p-6">Error loading lessons: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] p-6 md:p-12 flex flex-col gap-8 mx-auto text-white">
      
      {/* === HEADER SECTION === */}
      {selectedLesson ? (
        // LESSON VIEW HEADER
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-8 duration-300">
          
          {/* BACK BUTTON */}
          <button 
            onClick={handleBackClick}
            className="group flex items-center gap-2 text-xl font-bold text-white hover:text-[#B1E7D6] transition-colors self-start mb-2"
          >
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={3} 
                stroke="currentColor" 
                className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {selectedLesson.title}
          </button>

          <ProgressCard width="w-full" completed={progress.completed} total={progress.total} />
          <TokensCard isFullWidth={true} />
        </div>
      ) : (
        // DASHBOARD VIEW HEADER
        <div className="flex flex-col lg:flex-row gap-6 w-full">
          <div className="flex-grow">
            <ProgressCard width="w-full" completed={progress.completed} total={progress.total} />
          </div>
          <div className="w-full lg:w-[300px] shrink-0">
             <BadgesCard badges={badges} />
          </div>
        </div>
      )}

      {/* === MAIN CONTENT SECTION === */}
      {selectedLesson ? (
        // === LESSON VIEW (Task Cards) ===
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
           {/* Task Wrapper */}
          <div className="bg-[#B1E7D6] rounded-3xl p-6 md:p-8 flex flex-col gap-6">
            <div className="font-semibold text-[#1f2e3b] text-lg">Task Cards</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pre-Lesson Work */}
              <TaskCard 
                title="Pre-Lesson Work" 
                instruction={selectedLesson.description ?? "Complete the pre-lesson work for this lesson."}
                url={preLessonTasks}
              />
              
              {/* Post-Lesson Work */}
              <TaskCard 
                title="Post-Lesson Work" 
                instruction={selectedLesson.description ?? "Complete the post-lesson work for this lesson."}
                url={postLessonTasks}
              />
            </div>
          </div>

          {/* Footer Banner Image Mockup */}
           <div className="mt-8 w-full h-[120px] bg-gradient-to-r from-[#9b72cb] to-[#8659c2] rounded-t-3xl border-b-0 flex items-center px-12 relative overflow-hidden">
              <a href = {slideShow}>Download Slide Show</a>
          </div>
        </div>
      ) : (
        // === DASHBOARD VIEW (Lesson Grid) ===
        <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] pb-12 animate-in fade-in duration-300">
          {lessonCardsData.map(({ lesson, lessonNumber, icon, isCompleted, onClick }) => (
            <LessonCard
              key={lesson.id}
              lessonNumber={lessonNumber}
              title={lesson.title}
              icon={icon}
              onClick={onClick}
              isCompleted={isCompleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* --- SUBCOMPONENTS --- */

const ProgressCard = memo(function ProgressCard({ width, completed, total }: { width?: string; completed: number; total: number }) {
    const percent = useMemo(() => total > 0 ? Math.round((completed / total) * 100) : 0, [completed, total]);
    return (
        <div className={`bg-white text-[#1f2e3b] rounded-lg p-6 md:px-8 md:py-6 h-[100px] flex flex-col justify-center shadow-lg ${width}`}>
            <div className="flex justify-between items-center font-bold text-sm mb-3">
              <span>Lesson Progress</span>
              <span className="text-gray-500">{completed}/{total}</span>
            </div>
            {/* Progress Bar Container */}
            <div className="w-full h-4 bg-[#B1E7D6] rounded-full overflow-hidden">
                {/* Filled portion */}
                <div className="h-full bg-[#2B4257] rounded-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    )
});

const BadgesCard = memo(function BadgesCard({ badges }: { badges: BadgeRow[] }) {
    const rowRef = useRef<HTMLDivElement>(null);
    const [badgeSizePx, setBadgeSizePx] = useState(BADGES_MIN_SIZE_PX);
    const [isCapped, setIsCapped] = useState(false);
    const displayBadges = useMemo(() => badges.slice(0, BADGES_DISPLAY_LIMIT), [badges]);
    const count = displayBadges.length;

    useEffect(() => {
        const el = rowRef.current;
        if (!el || count === 0) return;

        const updateSize = () => {
            const width = el.clientWidth;
            const totalGap = (count - 1) * BADGES_GAP_PX;
            const rawSize = (width - totalGap) / count;
            const clamped = Math.min(BADGES_MAX_SIZE_PX, Math.max(BADGES_MIN_SIZE_PX, Math.floor(rawSize)));
            setBadgeSizePx(clamped);
            setIsCapped(rawSize > BADGES_MAX_SIZE_PX);
        };

        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, [count]);

    return (
        <div className="bg-white text-[#1f2e3b] rounded-lg p-4 h-[100px] flex flex-col shadow-lg relative overflow-hidden">
             <div className="font-bold text-xs mb-1 z-10">Badges</div>
             <div
                ref={rowRef}
                className={`flex items-center z-10 mt-1 flex-1 min-h-0 w-full ${isCapped ? "justify-center" : "justify-start"}`}
                style={{ gap: BADGES_GAP_PX }}
             >
                {displayBadges.length > 0 ? (
                  displayBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center justify-center rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex-grow-0"
                      style={{ width: badgeSizePx, height: badgeSizePx }}
                      title={badge.title}
                    >
                      {badge.icon_url ? (
                        <img
                          src={badge.icon_url}
                          alt={badge.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-lg">🏆</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">No badges yet</span>
                )}
             </div>
             <div className="absolute -right-4 -bottom-4 opacity-10 text-6xl pointer-events-none">
                🏆
             </div>
        </div>
    )
});

const TokensCard = memo(function TokensCard({ isFullWidth }: { isFullWidth?: boolean }) {
    return (
        <div className={`bg-[#B1E7D6] text-[#1f2e3b] rounded-lg p-6 flex flex-col justify-center shadow-lg h-[180px] w-full relative`}>
             <div className="font-bold text-sm mb-4">Tokens</div>
             <div className="flex flex-wrap gap-4 md:gap-8 text-3xl md:text-4xl">
                <span>🧭</span>
                <span>🔭</span>
                <span>⭐️</span>
                <span>🏹</span>
                <span>🍍</span>
                <span>🗺️</span>
                <span>🐚</span>
                <span className="scale-125 drop-shadow-md">🥥</span>
                <span className="opacity-30">⭐️</span>
                <span className="opacity-30">⭐️</span>
                <span className="opacity-30">⭐️</span>
             </div>
        </div>
    )
});

const TaskCard = memo(function TaskCard({ title, instruction , url}: { title: string, instruction: string, url: string | null }) {
    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg flex flex-col h-full min-h-[300px]">
            {/* Header */}
            <div className="bg-[#2B4257] text-white p-4 font-semibold text-sm tracking-wide">
                {title}
            </div>
            {/* Body */}
            <div className="p-6 text-[#1f2e3b] flex-1 flex flex-col gap-4 text-sm">
                <p className="font-bold">{instruction}</p>
                
                <div className="space-y-1">
                   <a href = {url ?? ""}>Click To Get Task!</a>
                </div>
            </div>
        </div>
    )
});

const LessonCard = memo(function LessonCard({
  lessonNumber,
  title,
  icon,
  onClick,
  isCompleted,
}: {
  lessonNumber: number;
  title: string;
  icon: string;
  onClick: () => void;
  isCompleted?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="relative w-full h-[240px] rounded-xl bg-[#C5F0E1] p-4 
                 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
    >
      <div className="absolute top-4 left-5 flex items-center gap-2">
        <div className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
          Lesson {lessonNumber}
        </div>
        
        {/* Completion Checkbox */}
        <div className="w-6 h-6 bg-white rounded-lg shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
          {isCompleted ? (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#2B4257" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <div className="w-3.5 h-3.5 border-2 border-[#2B4257] rounded-sm"></div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-5 w-14 h-14 rounded-xl bg-white text-3xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[85px] bg-[#66d0ae] rounded-b-xl flex items-center justify-center px-4">
        <span className="text-white font-bold text-center leading-tight">
          {title}
        </span>
      </div>
    </div>
  );
});



