"use server"
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
export async function getLessonSpace(){
    const supabase = await createClient();
    const cookieStore = await cookies();
    const student_id = cookieStore.get('active_profile_id')?.value;

    if(!student_id){
        throw new Error("Unable to identify student")
    }
    try{
        console.log("Retrieving link")
        const {data,error}= await supabase.from('students').select('lesson_space_student_link').eq('id',student_id).single();
        if(!data){
            return;
        }
        

        
        return data.lesson_space_student_link;
    }catch(err){
        console.log("Error fetching lesson_space_id for student" + err)
    }
}