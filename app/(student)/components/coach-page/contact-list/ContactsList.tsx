"use client";
import Link from "next/link";

export type Contact = {
  id: string;
  name: string;
};

export type ContactsListProps = {
  contacts?: Contact[];
  filter?: string;
  //onContactClick?: (contactId: string) => void;
};

export default function ContactsList({ contacts = [], filter = "" }: ContactsListProps) {
  const filterString = filter.trim().toLowerCase();
  const visible = filterString
    ? contacts.filter((c) => c.name.toLowerCase().includes(filterString))
    : contacts;

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((c) => (
        <Link
          key={c.id}
          href={`/message/${c.id}`}
          className="flex items-center w-full h-13 px-3 py-1.5 
                     rounded-lg bg-white cursor-pointer"
        >
          <div className="bg-[#1F2E3B] h-full w-9 rounded-md flex justify-center items-center">
            {/* SVG icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21.3243 20.0625C19.7755 17.385 17.293 15.5569 ..." fill="#B1E7D6"/>
            </svg>
          </div>
          <p className="ml-3 text-[#1f2e3b]">{c.name}</p>
        </Link>
      ))}
    </div>
  );
}

{/* Unread messages */}
          {/* <div
            className="w-6 h-6 rounded-full border-2 border-[#1F2E3B]
           text-[#1F2E3B] text-center ml-auto"
          >
            1
          </div> */}