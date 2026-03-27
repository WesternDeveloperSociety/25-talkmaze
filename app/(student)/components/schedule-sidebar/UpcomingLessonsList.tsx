type Lesson = {
    id: string;
    title: string;
    starts_at: Date;
};

type UpcomingLessonsListProps = {
    lessons: Lesson[];
    selectedLessonId: string | null;
    onSelectLesson: (id: string) => void;
};

const UpcomingLessonsList = ({ lessons, selectedLessonId, onSelectLesson }: UpcomingLessonsListProps) => {

    const formatDate = (date: Date) => {
        const options: Intl.DateTimeFormatOptions = {
            weekday: "long",
            month: "long",
            day: "numeric",
        };
        return date.toLocaleDateString("en-US", options);
    };


    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    return (
        <div className="w-full flex flex-1 flex-col gap-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {lessons.map((lesson) => {
                const isSelected = selectedLessonId === lesson.id;
                return (
                    <div
                        key={lesson.id}
                        onClick={() => onSelectLesson(lesson.id)}
                        className={`w-full h-[72px] p-4 border-[0.5px] rounded-xl font-semibold border-[#4E4C4C] shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] flex justify-between items-center cursor-pointer ${isSelected
                            ? "bg-[#1F2E3B] text-[#65CFAD]"
                            : "bg-white text-[#2B4257]"
                            }`}
                    >
                        <div>
                            <p>{formatDate(lesson.starts_at)}</p>
                            <p>{lesson.title}</p>
                        </div>
                        <p>{formatTime(lesson.starts_at)}</p>
                    </div>
                );
            })}
        </div>
    );
};

export default UpcomingLessonsList;
