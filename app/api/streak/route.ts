import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getActivityDates } from '@/lib/user-activity'
import {
  applyAutoStreakFreeze,
  canCompleteWithoutPayment,
  getFreezeSettings,
  nextRefillDate,
  purchaseBlockedReason,
  refillMonthlyFreezes,
  restoreOffer,
} from '@/lib/streak-freeze'
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

  const settings = await getFreezeSettings(prisma)
  await refillMonthlyFreezes(prisma, user.id, settings.freePerMonth)
  await applyAutoStreakFreeze(prisma, user.id, realDateStrings)

  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      createdAt: true,
      isTestUser: true,
      streakFreezesAvailable: true,
      paidStreakFreezes: true,
      streakFreezesUsed: true,
      frozenDates: true,
    },
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
    // Total left (free + bought) — kept for older app versions.
    freezesAvailable: fresh.streakFreezesAvailable + fresh.paidStreakFreezes,
    freezesUsed: fresh.streakFreezesUsed,
    freezes: {
      free: fresh.streakFreezesAvailable,
      freePerMonth: settings.freePerMonth,
      paid: fresh.paidStreakFreezes,
      maxPaid: settings.maxPaid,
      refillsOn: nextRefillDate(today).toISOString(),
      pricePaise: settings.pricePaise,
      // Null when buying is allowed right now, else why not.
      purchaseBlockedReason: purchaseBlockedReason(fresh, settings),
      // False until Razorpay is connected (except test accounts / mock mode).
      paymentsEnabled: canCompleteWithoutPayment(fresh),
    },
    // Set when yesterday's miss just broke a streak with no freeze left to save it.
    restore: restoreOffer(realDateStrings, fresh.frozenDates, fresh.streakFreezesAvailable + fresh.paidStreakFreezes),
    nextMilestone: getNextMilestone(streak),
    weekStrip: buildWeekStrip(dateStrings, today, fresh.createdAt),
    calendar: {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth(),
      days: buildMonthCalendar(dateStrings, today.getUTCFullYear(), today.getUTCMonth(), today),
    },
  })
}
