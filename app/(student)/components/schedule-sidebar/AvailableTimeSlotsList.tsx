type TimeSlot = {
    id: string;
    date: Date;
    coach: string;
};

type AvailableTimeSlotsListProps = {
    timeSlots: TimeSlot[];
    selectedLessonTitle: string;
    selectedTimeSlotId: string | null;
    onSelectTimeSlot: (id: string) => void;
};

const AvailableTimeSlotsList = ({
    timeSlots,
    selectedLessonTitle,
    selectedTimeSlotId,
    onSelectTimeSlot,
}: AvailableTimeSlotsListProps) => {

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
            {timeSlots.map((timeSlot) => {
                const isSelected = selectedTimeSlotId === timeSlot.id;
                return (
                    <div
                        key={timeSlot.id}
                        onClick={() => onSelectTimeSlot(timeSlot.id)}
                        className={`w-full h-[72px] p-4 border-[0.5px] rounded-xl font-semibold border-[#4E4C4C] shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] flex justify-between items-center cursor-pointer ${isSelected
                            ? "bg-[#1F2E3B] text-[#65CFAD]"
                            : "bg-white text-[#2B4257]"
                            }`}
                    >
                        <div>
                            <p>{formatDate(timeSlot.date)}</p>
                            <p>{selectedLessonTitle}</p>
                        </div>
                        <p>{formatTime(timeSlot.date)}</p>
                    </div>
                );
            })}
        </div>
    );
};

export default AvailableTimeSlotsList;
