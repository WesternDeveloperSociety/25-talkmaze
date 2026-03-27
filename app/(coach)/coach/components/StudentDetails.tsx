"use client";

import { useState, useEffect } from "react";
import { ConversationClient } from "@/app/(student)/message/[id]/_client";

interface Student {
  id: string;
  name: string;
  tw_id: string | null;
}

interface StudentDetailsProps {
  student: Student | null;
  currentUserId: string;
  currentUserEmail: string;
  autoOpenChat?: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${period}`;
}

export default function StudentDetails({
  student,
  currentUserId,
  currentUserEmail,
  autoOpenChat,
}: StudentDetailsProps) {
  const [showChat, setShowChat] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Reset when student changes
  useEffect(() => {
    setShowChat(false);
    setConversationId(null);
    setMessages([]);
    setSessions([]);
  }, [student?.id]);

  // Auto-open chat
  useEffect(() => {
    if (autoOpenChat && autoOpenChat === student?.id && !showChat) {
      handleMessageClick();
    }
  }, [autoOpenChat, student?.id]);

  // Fetch schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!student) return;

      setLoadingSchedule(true);
      try {
        const res = await fetch(
          `/api/coach/student/schedule?studentId=${student.id}`
        );
        if (!res.ok) throw new Error("Failed to load schedule");

        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchSchedule();
  }, [student?.id]);

  const handleMessageClick = async () => {
    if (showChat) {
      setShowChat(false);
      return;
    }

    if (!student) return;

    setLoadingChat(true);
    try {
      const res = await fetch(
        `/api/coach/conversation?contactId=${student.id}`
      );
      if (!res.ok) throw new Error("Failed to load conversation");

      const { conversationId } = await res.json();

      const msgsRes = await fetch(
        `/api/coach/conversation/message?conversationId=${conversationId}`
      );
      const msgs = msgsRes.ok ? await msgsRes.json() : [];

      setConversationId(conversationId);
      setMessages(msgs);
      setShowChat(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChat(false);
    }
  };

  if (!student) {
    return (
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="7" r="4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Select a student</h3>
        <p className="mt-1 text-sm text-gray-500 max-w-xs">
          Click a student in your list to view their coaching details.
        </p>
      </div>
    );
  }

  const byDay = sessions.reduce((acc: any, s: any) => {
    acc[s.weekday] = acc[s.weekday] || [];
    acc[s.weekday].push(s);
    return acc;
  }, {});

  return (
    <div className="bg-white border rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Student Details
        </h2>

        <button
          onClick={handleMessageClick}
          disabled={loadingChat}
          className="px-4 py-2 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {loadingChat
            ? "Loading..."
            : showChat
            ? "Hide Chat"
            : "Message Student"}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {showChat && conversationId ? (
          <ConversationClient
            conversation={{ id: conversationId }}
            user={{ id: currentUserId, name: currentUserEmail }}
            messages={messages}
          />
        ) : (
          <div className="p-8 flex-1 overflow-y-auto">
            {/* Student header */}
            <div className="flex items-center space-x-5 mb-8">
              <div className="h-20 w-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {student.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {student.name}
                </h1>
                <p className="text-sm text-gray-500">
                  Student ID: {student.tw_id || "N/A"}
                </p>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-gray-50 rounded-lg p-6 border">
              <h3 className="text-md font-semibold text-gray-900 mb-4">
                Upcoming Schedule
              </h3>

              {loadingSchedule ? (
                <p className="text-sm text-gray-400">
                  Loading schedule...
                </p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No sessions scheduled.
                </p>
              ) : (
                <div className="space-y-4">
                  {DAYS.map((day, idx) => {
                    const daySessions = byDay[idx] || [];
                    if (daySessions.length === 0) return null;

                    return (
                      <div key={day}>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          {day}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {daySessions.map((s: any) => (
                            <div
                              key={s.id}
                              className="bg-white border rounded-md px-3 py-2 text-xs"
                            >
                              <div className="font-medium text-gray-800">
                                {fmtTime(s.start_time)} –{" "}
                                {fmtTime(s.end_time)}
                              </div>

                              <div className="text-gray-500">
                                {s.coach?.name || "Coach TBD"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}