"use server";
import { ReactNode } from "react";
import Bookmarks from "../components/coach-page/Bookmarks";
import Contacts from "../components/coach-page/Contacts";
import { createClient } from "@/utils/supabase/server";
import { Contact } from "@/lib/types/contact";
import { getCurrentUser } from "@/utils/supabase/lib/getCurrentUser";

// Layout of Coach Page both for /coach and /coach/[conversation]
export default async function Layout({ children }: { children: ReactNode }) {
    // Retrieve contacts from supabase, and pass them as props to Contact list
    const contacts: Contact[] = await getContacts();

    return (
        <div
            className="flex flex-col md:flex-row md:gap-6 h-full max-h-[85vh] 
      rounded-xl mx-2 mb-2 p-3 lg:mb-6 "
        >
            <div className="flex flex-col max-w-[384px] md:basis-1/3">
                {/* Contacts filter bar*/}
                <Contacts contacts={contacts} />
                {/* Bookmarks */}
                <Bookmarks />
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">{children}</div>
        </div>
    );
}

/**
 * Fetch (id, email, teachworks_id) from all accounts records in the Supabase 
 * database, except the account of the logged in user.
 *
 * @returns Array holding information retrieved from all account records.
 *          Each element is an object in the shape of type 'Contact'
 *          defined in contact.ts
 */
async function getContacts(): Promise<Contact[]> {
    const supabase = await createClient();
    const user = await getCurrentUser();

    // Build the base query to fetch account fields needed by the UI
    let query = supabase
        .from("account")
        .select("id, email, tw_customer_id")
        .order("email");

    // If a user is logged in, exclude them from the results
    if (user?.id) {
        query = query.neq("id", user.id);
    }

    // Execute the query and handle any errors
    const { data, error } = await query;
    if (error) {
        console.error("Error fetching contacts:", error);
        return [];
    }

    // Map the raw rows fetched from Supabase to the Contact.ts shape
    return data.map((account) => ({
        id: account.id,
        name: account.email, // Using email as display name for now
        email: account.email,
        tw_customer_id: account.tw_customer_id || "",
    }));
}