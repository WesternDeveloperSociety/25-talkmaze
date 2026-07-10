export type Student = {
  id: string;
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  date_of_birth: string | null;
  grade: string | null;
  lesson_space_id: string | null;
  lesson_space_student_link: string | null;
  lesson_space_teacher_link: string | null;
  location: string | null;
  notes: string | null;
  post_lesson_days: number | null;
  post_lesson_tasks_enabled: boolean | null;
  webhook_room_id: string | null;
};

export type Coach = {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
};

export type Assignment = {
  id: string;
  coach_id: string;
  student_id: string;
  created_at?: string;
  coaches?: {
    first_name: string | null;
    last_name: string | null;
  };
  students?: {
    first_name: string | null;
    last_name: string | null;
    account_id: string | null;
  };
};
