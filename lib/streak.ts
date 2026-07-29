// Consecutive-day streak from a set of activity dates (completed QuizAttempts
// and/or completed stages) — any activity on a day counts toward that day.
export function computeStreakFromDates(dates: Date[]): number {
  const dateStrings = new Set(dates.map((d) => d.toISOString().slice(0, 10)))
  if (dateStrings.size === 0) return 0

  const today = new Date()
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  // If today has no activity yet, start counting from yesterday so the streak
  // doesn't visually reset before the user has had a chance to play today.
  if (!dateStrings.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let streak = 0
  while (dateStrings.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}
