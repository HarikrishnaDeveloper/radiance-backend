import type { PrismaClient } from '@prisma/client'

// Any completed quiz attempt, stage, or daily challenge counts as activity
// for that calendar day — shared by the dashboard and streak routes.
export async function getActivityDates(prisma: PrismaClient, userId: string): Promise<Date[]> {
  const [attempts, stages, dailyChallenges] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.userStageProgress.findMany({
      where: { userId, status: 'COMPLETED', completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.userDailyChallengeProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { completedAt: true },
    }),
  ])

  return [
    ...attempts.map((a) => a.completedAt!),
    ...stages.map((s) => s.completedAt!),
    ...dailyChallenges.map((d) => d.completedAt!),
  ]
}
