/**
 * Current attendance streak: consecutive "attended" sessions from the most recent
 * record backward. "cancelled" is skipped (neither counts nor breaks); any other
 * status ("missed") breaks the streak. Records MUST be ordered newest-first.
 */
export function computeAttendanceStreak(
  records: ReadonlyArray<{ status: string }>,
): number {
  let streak = 0;
  for (const record of records) {
    if (record.status === "attended") streak++;
    else if (record.status === "cancelled") continue;
    else break;
  }
  return streak;
}
