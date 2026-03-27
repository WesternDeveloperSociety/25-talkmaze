"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactsList from "./contact-list/ContactsList";
import ContactsFilterInput from "./contact-list/ContactsFilterInput";
import { Contact } from "@/lib/types/contact";

/**
 * This component renders the contact filter bar and the contact list
 * @param param0 Array of contacts to display when filter bar is focused
 */
export default function Contacts({ contacts }: { contacts: Contact[] }) {
  const [filter, setFilter] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const handleContactClick = (contactId: string) => {
    router.push(`/message/${contactId}`);
  };

  return (
    <div className="relative">
      {/* Overlay */}
      {isFocused && (
        <div className="fixed inset-0 bg-black/30 z-10" />
      )}

      <div className="relative z-20">
        <ContactsFilterInput
          value={filter}
          onChange={setFilter}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 100)}
        />

        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <ContactsList
              contacts={contacts}
              filter={filter}
              //onContactClick={handleContactClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}