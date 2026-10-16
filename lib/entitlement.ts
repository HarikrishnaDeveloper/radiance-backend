import { prisma } from '@/lib/prisma'

// Stages a user may complete before a subscription is required. Counted
// globally (across all categories), not per-category — see AGENTS notes on
// the paywall for why: it's a single "try before you buy" budget, not a
// per-subject one.
export const FREE_STAGE_LIMIT = 2

// While the app is in testing, nothing is paywalled: every user gets full
// access to all stages and papers. Set PAYMENTS_ENABLED=true to restore the
// free-stage budget and subscription gating.
export const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true'

export async function hasFullAccess(userId: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return true
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isTestUser: true, isPremium: true },
  })
  return Boolean(user?.isTestUser || user?.isPremium)
}

// A stage is accessible if the user has paid/test access, already completed
// it before (so review/retry never gets newly blocked), or hasn't yet used
// up their free-stage budget. Once FREE_STAGE_LIMIT stages are completed,
// any *new* stage requires a subscription.
export async function canAccessStage(userId: string, stageId: number): Promise<boolean> {
  if (await hasFullAccess(userId)) return true

  const [ownProgress, completedCount] = await Promise.all([
    prisma.userStageProgress.findUnique({
      where: { userId_stageId: { userId, stageId } },
      select: { status: true },
    }),
    prisma.userStageProgress.count({ where: { userId, status: 'COMPLETED' } }),
  ])

  if (ownProgress?.status === 'COMPLETED') return true
  return completedCount < FREE_STAGE_LIMIT
}
