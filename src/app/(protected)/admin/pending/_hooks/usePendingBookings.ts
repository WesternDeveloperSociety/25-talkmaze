"use client";

import { useEffect, useState, useMemo } from "react";
import { api, apiFetch } from "@/src/lib/api/routes";
import type {
  PendingBooking,
  PendingBookingForm,
  PendingBookingPreviewPayload,
} from "@/src/lib/scheduling/types";
import type { Coach } from "../../_types";

// Exported so page.tsx can pass the same value to <Pagination>
export const ITEMS_PER_PAGE = 6;

/** Strips seconds from a "HH:MM:SS" time string */
function timeInputValue(value: string) {
  return value.slice(0, 5);
}

/**
 * Derives the weekday (0 = Sunday) from a YYYY-MM-DD date string.
 * Uses UTC noon to avoid day-boundary shifts caused by timezone offsets.
 * Returns null if the string is not a valid date.
 */
function weekdayFromDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00Z`).getUTCDay();
}

/** Converts a PendingBooking record into the editable form shape. */
export function formFromPendingBooking(
  booking: PendingBooking,
): PendingBookingForm {
  return {
    coach_id: booking.coach_id,
    weekday: booking.weekday,
    start_date: booking.start_date ?? "",
    start_time: timeInputValue(booking.start_time),
    end_time: timeInputValue(booking.end_time),
    timezone: booking.timezone,
    num_sessions: booking.num_sessions ?? 1,
  };
}

/**
 * Manages all state, data-fetching, derived values, and action handlers
 * for the pending bookings admin page.
 *
 * Separation of concerns: this hook owns data and behaviour;
 * page.tsx + sub-components own layout and presentation.
 */
export function usePendingBookings() {
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [pendingBookingsLoading, setPendingBookingsLoading] = useState(true);
  const [approvingBookingId, setApprovingBookingId] = useState<string | null>(
    null,
  );
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editingBookingForm, setEditingBookingForm] =
    useState<PendingBookingForm | null>(null);
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [selectedPendingBookingId, setSelectedPendingBookingId] = useState<
    string | null
  >(null);
  const [pendingPreview, setPendingPreview] =
    useState<PendingBookingPreviewPayload | null>(null);
  const [pendingPreviewLoading, setPendingPreviewLoading] = useState(false);
  const [pendingPreviewError, setPendingPreviewError] = useState("");
  const [employees, setEmployees] = useState<Coach[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * Fetches the full list of pending bookings and resets pagination to page 1.
   * Preserves the current selection if it still exists in the new list;
   * otherwise falls back to the first booking.
   */
  const fetchPendingBookings = async () => {
    try {
      setPendingBookingsLoading(true);
      const res = await apiFetch(api.bookedSlots.list({ status: "pending" }));
      if (!res.ok) throw new Error();
      const data = await res.json();
      const bookings = Array.isArray(data?.booked_slots)
        ? data.booked_slots
        : [];
      setPendingBookings(bookings);
      setCurrentPage(1);
      // Keep the current selection if it's still in the list.
      setSelectedPendingBookingId(
        (current) => current ?? bookings[0]?.id ?? null,
      );
    } catch {
      setPendingBookings([]);
    } finally {
      setPendingBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBookings();
    apiFetch(api.coaches.list())
      .then((r) => r.json())
      .then((d) => setEmployees(Array.isArray(d?.employees) ? d.employees : []))
      .catch(() => {});
  }, []);

  // The booking that is currently shown in the detail panel.
  // Falls back to the first booking so the panel is never blank after load.
  const selectedPendingBooking = useMemo(
    () =>
      pendingBookings.find((b) => b.id === selectedPendingBookingId) ??
      pendingBookings[0] ??
      null,
    [pendingBookings, selectedPendingBookingId],
  );

  // The form values shown in the detail panel.
  // Uses the live edit state when the booking is being edited
  const selectedPendingBookingForm = useMemo(
    () =>
      selectedPendingBooking
        ? editingBookingId === selectedPendingBooking.id && editingBookingForm
          ? editingBookingForm
          : formFromPendingBooking(selectedPendingBooking)
        : null,
    [editingBookingForm, editingBookingId, selectedPendingBooking],
  );

  // The earliest proposed or conflicting session date
  const pendingPreviewInitialDate = useMemo(() => {
    const datedEvents = (pendingPreview?.events ?? [])
      .filter((e) => e.kind === "proposed" || e.kind === "conflict")
      .map((e) => ("start" in e ? e.start : null))
      .filter((start): start is string => !!start)
      .sort();
    return datedEvents[0];
  }, [pendingPreview]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pendingBookings.length / ITEMS_PER_PAGE)),
    [pendingBookings.length],
  );

  // The slice of bookings visible on the current page.
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return pendingBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [pendingBookings, currentPage]);

  /**
   * Fetches a calendar preview for the selected booking whenever the selection
   * or the form values change.
   *
   * Uses a `cancelled` flag to discard responses from stale fetches
   */
  useEffect(() => {
    if (!selectedPendingBooking || !selectedPendingBookingForm) {
      setPendingPreview(null);
      return;
    }

    let cancelled = false;
    async function loadPreview() {
      setPendingPreviewLoading(true);
      setPendingPreviewError("");
      try {
        const res = await apiFetch(
          api.bookedSlots.preview(selectedPendingBooking!.id),
          {
            method: "POST",
            json: selectedPendingBookingForm,
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load preview");
        if (!cancelled) setPendingPreview(data);
      } catch (error) {
        if (!cancelled) {
          setPendingPreview(null);
          setPendingPreviewError(
            error instanceof Error ? error.message : "Failed to load preview",
          );
        }
      } finally {
        if (!cancelled) setPendingPreviewLoading(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedPendingBooking?.id, selectedPendingBookingForm]);

  /**
   * Approves the booking, removes it from the list, and clamps the current page
   * downward if the removal shrinks the list past the current page boundary.
   */
  const handleApprovePendingBooking = async (bookingId: string) => {
    setApprovingBookingId(bookingId);
    const res = await apiFetch(api.bookedSlots.approve(bookingId), {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setApprovingBookingId(null);
    if (!res.ok) {
      alert(data.error ?? "Failed to approve booking");
      return;
    }
    setPendingBookings((prev) => {
      const next = prev.filter((b) => b.id !== bookingId);
      // Clamp page so we don't get empty page if last item is removed
      const maxPage = Math.max(1, Math.ceil(next.length / ITEMS_PER_PAGE));
      setCurrentPage((p) => Math.min(p, maxPage));
      return next;
    });
    setSelectedPendingBookingId((current) =>
      current === bookingId ? null : current,
    );
  };

  /** Enters edit mode for a booking, seeding the form from the current record values. */
  const startEditingPendingBooking = (booking: PendingBooking) => {
    setSelectedPendingBookingId(booking.id);
    setEditingBookingId(booking.id);
    setEditingBookingForm(formFromPendingBooking(booking));
  };

  /** Exits edit mode without saving, discarding any unsaved form changes. */
  const cancelEditingPendingBooking = () => {
    setEditingBookingId(null);
    setEditingBookingForm(null);
  };

  /**
   * Updates a single field in the edit form.
   * If edit mode hasn't been entered yet (form is null), seeds the form from
   * the current record before applying the change.
   */
  const updateEditingBookingForm = <K extends keyof PendingBookingForm>(
    key: K,
    value: PendingBookingForm[K],
  ) => {
    setEditingBookingForm((prev) => {
      const base =
        prev ??
        (selectedPendingBooking
          ? formFromPendingBooking(selectedPendingBooking)
          : null);
      return base ? { ...base, [key]: value } : base;
    });
  };

  /** PATCHes the booking with the current form values and exits edit mode on success. */
  const handleSavePendingBooking = async (bookingId: string) => {
    if (!editingBookingForm) return;
    setSavingBookingId(bookingId);
    const res = await apiFetch(api.bookedSlots.update(bookingId), {
      method: "PATCH",
      json: editingBookingForm,
    });
    const data = await res.json().catch(() => ({}));
    setSavingBookingId(null);
    if (!res.ok) {
      alert(data.error ?? "Failed to update booking");
      return;
    }
    // Replace the stale record in the list with the updated one returned by the API.
    setPendingBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? data.booked_slot : b)),
    );
    cancelEditingPendingBooking();
  };

  return {
    pendingBookings,
    pendingBookingsLoading,
    paginatedBookings,
    currentPage,
    totalPages,
    setCurrentPage,
    approvingBookingId,
    editingBookingId,
    savingBookingId,
    selectedPendingBooking,
    selectedPendingBookingForm,
    pendingPreview,
    pendingPreviewLoading,
    pendingPreviewError,
    pendingPreviewInitialDate,
    employees,
    fetchPendingBookings,
    handleApprovePendingBooking,
    startEditingPendingBooking,
    cancelEditingPendingBooking,
    updateEditingBookingForm,
    handleSavePendingBooking,
    setSelectedPendingBookingId,
    weekdayFromDateInput,
  };
}
