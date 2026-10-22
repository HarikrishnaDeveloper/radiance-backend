import type { Prisma, PrismaClient } from '@prisma/client'

// Streak freezes protect the daily streak when a day is missed.
//
// - Every month each student gets `freePerMonth` free freezes. The allowance
//   is topped back up on their first visit of a new month and unused ones
//   don't roll over.
// - Once the free ones are gone they can buy more at `pricePaise` each
//   (holding at most `maxPaid`). Bought freezes never expire.
// - A freeze is spent automatically (free first, then bought) when the student
//   was active two days ago but missed yesterday, so today still extends the
//   streak. If they had none left, the streak page offers to restore it by
//   buying one, which is then applied to the missed day straight away.
//
// The three numbers are editable from the admin panel (StreakFreezeSettings).
export type FreezeSettings = { freePerMonth: number; pricePaise: number; maxPaid: number }

export const DEFAULT_FREEZE_SETTINGS: FreezeSettings = { freePerMonth: 2, pricePaise: 500, maxPaid: 5 }

/** The current rules, falling back to the defaults if they were never saved. */
export async function getFreezeSettings(prisma: PrismaClient): Promise<FreezeSettings> {
  const row = await prisma.streakFreezeSettings.findUnique({ where: { id: 1 } })
  return row ? { freePerMonth: row.freePerMonth, pricePaise: row.pricePaise, maxPaid: row.maxPaid } : DEFAULT_FREEZE_SETTINGS
}

const dayString = (d: Date) => d.toISOString().slice(0, 10)
const monthKey = (d: Date) => d.toISOString().slice(0, 7)

function utcDay(offsetDays: number, from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d
}

/** First day of next month (UTC), when the free freezes next refill. */
export function nextRefillDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/**
 * Tops the free allowance back up to `freePerMonth` once per calendar month.
 * A changed allowance reaches each student at their next monthly refill.
 */
export async function refillMonthlyFreezes(prisma: PrismaClient, userId: string, freePerMonth: number) {
  const month = monthKey(new Date())
  await prisma.user.updateMany({
    where: { id: userId, OR: [{ freezesRefilledFor: null }, { freezesRefilledFor: { not: month } }] },
    data: { streakFreezesAvailable: freePerMonth, freezesRefilledFor: month },
  })
}

// Yesterday is missed and two days ago was a real active day: the one case a
// freeze can bridge. `realActivityDateStrings` must hold only real (non-frozen)
// activity, so a day that was itself frozen can't be bridged again.
function missedDayAtRisk(realActivityDateStrings: Set<string>, frozenDates: Date[]) {
  const yesterday = utcDay(-1)
  const yStr = dayString(yesterday)
  if (frozenDates.some((d) => dayString(d) === yStr)) return null
  if (realActivityDateStrings.has(yStr)) return null
  if (!realActivityDateStrings.has(dayString(utcDay(-2)))) return null
  return yesterday
}

/**
 * Spends one freeze (free first, then bought) to cover yesterday if a streak
 * is at risk. Returns true if a freeze was used.
 */
export async function applyAutoStreakFreeze(
  prisma: PrismaClient,
  userId: string,
  realActivityDateStrings: Set<string>
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakFreezesAvailable: true, paidStreakFreezes: true, frozenDates: true },
  })
  if (!user) return false
  const source = user.streakFreezesAvailable > 0 ? 'FREE' : user.paidStreakFreezes > 0 ? 'PAID' : null
  if (!source) return false

  const day = missedDayAtRisk(realActivityDateStrings, user.frozenDates)
  if (!day) return false

  // Only spend if the balance is still there (guards two requests racing).
  const balance: Prisma.UserWhereInput = source === 'FREE' ? { streakFreezesAvailable: { gt: 0 } } : { paidStreakFreezes: { gt: 0 } }
  const spent = await prisma.user.updateMany({
    where: { id: userId, ...balance, NOT: { frozenDates: { has: day } } },
    data: {
      frozenDates: { push: day },
      streakFreezesUsed: { increment: 1 },
      ...(source === 'FREE' ? { streakFreezesAvailable: { decrement: 1 } } : { paidStreakFreezes: { decrement: 1 } }),
    },
  })
  if (spent.count === 0) return false
  await prisma.streakFreezeUse.create({ data: { userId, day, source } })
  return true
}

/**
 * When yesterday's miss broke a streak and no freeze was left to cover it,
 * how long that streak was. The streak page offers to restore it by buying a
 * freeze. Null when there's nothing to restore.
 */
export function restoreOffer(
  realActivityDateStrings: Set<string>,
  frozenDates: Date[],
  freezesLeft: number
): { lostStreak: number; missedDay: string } | null {
  if (freezesLeft > 0) return null
  const missed = missedDayAtRisk(realActivityDateStrings, frozenDates)
  if (!missed) return null

  const active = new Set([...realActivityDateStrings, ...frozenDates.map(dayString)])
  let lostStreak = 0
  for (let cursor = utcDay(-2); active.has(dayString(cursor)); cursor.setUTCDate(cursor.getUTCDate() - 1)) lostStreak++
  return { lostStreak, missedDay: dayString(missed) }
}

/** Whether this student may buy a freeze right now, and why not if they can't. */
export function purchaseBlockedReason(
  user: { streakFreezesAvailable: number; paidStreakFreezes: number },
  settings: FreezeSettings
): string | null {
  if (user.streakFreezesAvailable > 0) return 'Use your free streak freezes first'
  if (settings.maxPaid <= 0) return 'Streak freezes can’t be bought right now'
  if (user.paidStreakFreezes >= settings.maxPaid) return `You can hold up to ${settings.maxPaid} streak freezes`
  return null
}

/**
 * Until Razorpay is connected for freezes, purchases can only be completed
 * without a real payment for test accounts, or everywhere when
 * STREAK_FREEZE_MOCK_PAYMENTS=true (local/staging). Everyone else sees
 * "coming soon".
 */
export function canCompleteWithoutPayment(user: { isTestUser: boolean }) {
  return user.isTestUser || process.env.STREAK_FREEZE_MOCK_PAYMENTS === 'true'
}

/**
 * Marks a purchase PAID and adds its freezes to the student's balance.
 * Idempotent: a purchase already PAID is left alone. The single place a
 * purchase is fulfilled — the Razorpay verify step and webhook should call
 * this (passing the Razorpay ids) once payments are connected.
 */
export async function fulfilFreezePurchase(
  prisma: PrismaClient,
  purchaseId: string,
  razorpay?: { orderId?: string; paymentId?: string }
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const marked = await tx.streakFreezePurchase.updateMany({
      where: { id: purchaseId, status: { not: 'PAID' } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(razorpay?.orderId ? { razorpayOrderId: razorpay.orderId } : {}),
        ...(razorpay?.paymentId ? { razorpayPaymentId: razorpay.paymentId } : {}),
      },
    })
    if (marked.count === 0) return false
    const purchase = await tx.streakFreezePurchase.findUniqueOrThrow({ where: { id: purchaseId } })
    await tx.user.update({ where: { id: purchase.userId }, data: { paidStreakFreezes: { increment: purchase.quantity } } })
    return true
  })
}
