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

// Longest run of consecutive activity days ever, not just the current one.
export function computeLongestStreak(dates: Date[]): number {
  const dateStrings = [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))].sort()
  if (dateStrings.length === 0) return 0

  let longest = 1
  let current = 1
  for (let i = 1; i < dateStrings.length; i++) {
    const prev = new Date(dateStrings[i - 1] + 'T00:00:00Z')
    const curr = new Date(dateStrings[i] + 'T00:00:00Z')
    const dayDiff = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
    current = dayDiff === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
  }
  return longest
}

// Last `days` calendar days (oldest first, today last), each true if any
// activity date falls on it — powers the streak "pips" row on the client.
export function recentActivityDays(dates: Date[], days = 7): boolean[] {
  const dateStrings = new Set(dates.map((d) => d.toISOString().slice(0, 10)))
  const today = new Date()
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1))

  const result: boolean[] = []
  for (let i = 0; i < days; i++) {
    result.push(dateStrings.has(cursor.toISOString().slice(0, 10)))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}
