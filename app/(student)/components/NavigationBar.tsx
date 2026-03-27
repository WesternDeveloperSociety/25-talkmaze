import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import StartVideoLessonBox from "./StartVideoLessonBox";
import AvatorIcon from "./AvatorIcon";
import { signOut } from "@/lib/auth/signout";


//Navigation Bar Component
export default function NavigationBar() {

  

  
  const router = useRouter();
  const pathname = usePathname();

  function goBack() {
    router.back();
  }

  let prefix = "Student";
  let page = "Dashboard";

  if (pathname.startsWith("/parent")) {
    prefix = "Parent";
    page = "Dashboard";
  } else if (pathname.startsWith("/lesson")) {
    page = "Lessons";
  } else if (pathname.startsWith("/coach")) {
    page = "Coach";
  } else if (pathname.startsWith("/reward")) {
    page = "Rewards";
  }

  const title = `${prefix} ${page}`;

  return (
    <div className="flex flex-row px-3.5 py-3 items-center justify-between md:px-8 md:py-6 lg:pl-0 max-w-full">
      {/* Back Button */}
      <div
        className="flex flex-row items-center min-w-[100px] h-[66px]"
        onClick={goBack}
      >
        <Image src="/caret.png" alt="caret" width={36} height={34.88} />
        <p
          className="hidden sm:inline text-white 
          md:text-2xl lg:text-3xl font-bold ml-3"
        >
          {title}
        </p>
      </div>
      {/* Profile & Video Lesson Buttons */}
      <div className="flex flex-row gap-4 md:gap-10 items-center relative left-[3%]">
        <button
          onClick={signOut}
          className="text-white hover:text-gray-300 font-medium"
        >
          Sign Out
        </button>

         
          <button className = 'w-30 h-10' onClick = {() => router.push('/payments')}>
            Manage Subscriptions
          </button>
          
        <StartVideoLessonBox />
        <AvatorIcon />
      </div>
    </div>
  );
}
