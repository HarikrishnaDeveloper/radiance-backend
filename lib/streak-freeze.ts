import type { PrismaClient } from '@prisma/client'

// Duolingo-style streak freeze: if the user was active two days ago but not
// yesterday (a one-day gap that would otherwise snap their streak back to
// zero), silently spend one available freeze to cover yesterday so today's
// activity still extends the streak. Only bridges a single missed day per
// freeze and only fires while a real streak was actually at risk — a user
// with no prior activity gets nothing to protect.
//
// `realActivityDateStrings` must be the set of real (non-frozen) activity
// day-strings, so this can't be re-triggered by a day it already froze.
export async function applyAutoStreakFreeze(
  prisma: PrismaClient,
  userId: string,
  realActivityDateStrings: Set<string>
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakFreezesAvailable: true, frozenDates: true },
  })
  if (!user || user.streakFreezesAvailable <= 0) return false

  const today = new Date()
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const yesterday = new Date(utcToday)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const twoDaysAgo = new Date(utcToday)
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

  const yStr = yesterday.toISOString().slice(0, 10)
  const twoStr = twoDaysAgo.toISOString().slice(0, 10)

  const alreadyFrozen = user.frozenDates.some((d) => d.toISOString().slice(0, 10) === yStr)
  if (alreadyFrozen) return false
  if (realActivityDateStrings.has(yStr)) return false
  if (!realActivityDateStrings.has(twoStr)) return false

  await prisma.user.update({
    where: { id: userId },
    data: {
      frozenDates: { push: yesterday },
      streakFreezesAvailable: { decrement: 1 },
      streakFreezesUsed: { increment: 1 },
    },
  })
  return true
}
