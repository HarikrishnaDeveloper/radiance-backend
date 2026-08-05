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

// Fixed badge thresholds for the streak page's "next milestone" card.
export const STREAK_MILESTONES = [3, 7, 15, 30, 60, 100, 180, 365]

export function getNextMilestone(streak: number): number {
  return STREAK_MILESTONES.find((m) => m > streak) ?? (Math.floor(streak / 100) + 1) * 100
}

export type DayStatus = 'done' | 'today' | 'future' | 'missed'

// The current calendar week, Monday first, for the streak page's week strip.
// `dateStrings` should already include any auto-frozen dates so a
// freeze-covered miss still shows as "done".
export function buildWeekStrip(dateStrings: Set<string>, today: Date): { label: string; status: DayStatus }[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const jsDay = utcToday.getUTCDay() // 0 = Sun .. 6 = Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(utcToday)
  monday.setUTCDate(monday.getUTCDate() + mondayOffset)
  const todayStr = utcToday.toISOString().slice(0, 10)

  const result: { label: string; status: DayStatus }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(d.getUTCDate() + i)
    const str = d.toISOString().slice(0, 10)

    let status: DayStatus
    if (str === todayStr) status = 'today'
    else if (d.getTime() > utcToday.getTime()) status = 'future'
    else status = dateStrings.has(str) ? 'done' : 'missed'

    result.push({ label: labels[i], status })
  }
  return result
}

export type CalendarDay = { day: number; hasActivity: boolean; isToday: boolean } | null

// A Sunday-first month grid (leading `null`s pad out to the first weekday)
// for the streak page's calendar card.
export function buildMonthCalendar(dateStrings: Set<string>, year: number, month: number, today: Date): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const leadingBlanks = firstOfMonth.getUTCDay() // 0 = Sun
  const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10)

  const days: CalendarDay[] = new Array(leadingBlanks).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const str = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
    days.push({ day, hasActivity: dateStrings.has(str), isToday: str === todayStr })
  }
  return days
}
