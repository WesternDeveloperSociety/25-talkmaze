import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
export async function getProgress(){

    const supabase = await createClient()
    const cookieStore = await cookies();
    const student_id = cookieStore.get('active_profile_id')?.value;

    if(!student_id){
        throw NextResponse.json({status: 500,message: "Error identifying student"})
    }
    try{
        const res1 = await supabase.from('course_assignment').select('progress, course_id').eq('student_id',student_id).eq('isActive',true).single()

        if(res1.error){
            throw NextResponse.json({status: 500,message: "Supabase fetching error"})
        }

        //get the total
        /*
        const res2 = await supabase.from('lessons').select('id').eq('course_id',res1.data.course_id).single()

        
        return {res1.data.progress,res2.data.size()}
        */

       
    }catch(err){
        throw NextResponse.json({status: 500,message: "Error getting progress"})
    }
}



