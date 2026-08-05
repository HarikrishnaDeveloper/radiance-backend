import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getActivityDates } from '@/lib/user-activity'
import { applyAutoStreakFreeze } from '@/lib/streak-freeze'
import {
  buildMonthCalendar,
  buildWeekStrip,
  computeLongestStreak,
  computeStreakFromDates,
  getNextMilestone,
} from '@/lib/streak'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const realActivityDates = await getActivityDates(prisma, user.id)
  const realDateStrings = new Set(realActivityDates.map((d) => d.toISOString().slice(0, 10)))

  await applyAutoStreakFreeze(prisma, user.id, realDateStrings)

  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { createdAt: true, streakFreezesAvailable: true, streakFreezesUsed: true, frozenDates: true },
  })
  if (!fresh) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const activityDates = [...realActivityDates, ...fresh.frozenDates]
  const dateStrings = new Set(activityDates.map((d) => d.toISOString().slice(0, 10)))

  const streak = computeStreakFromDates(activityDates)
  const longestStreak = computeLongestStreak(activityDates)
  const totalActiveDays = realDateStrings.size

  const today = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const daysSinceSignup = Math.max(1, Math.floor((today.getTime() - fresh.createdAt.getTime()) / msPerDay) + 1)
  const daysKeptPercent = Math.min(100, Math.round((dateStrings.size / daysSinceSignup) * 100))

  return NextResponse.json({
    streak,
    longestStreak,
    totalActiveDays,
    daysKeptPercent,
    freezesAvailable: fresh.streakFreezesAvailable,
    freezesUsed: fresh.streakFreezesUsed,
    nextMilestone: getNextMilestone(streak),
    weekStrip: buildWeekStrip(dateStrings, today),
    calendar: {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth(),
      days: buildMonthCalendar(dateStrings, today.getUTCFullYear(), today.getUTCMonth(), today),
    },
  })
}
