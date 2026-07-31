import { prisma } from '@/lib/prisma'

// Overall accuracy/questions-solved across both practice modes — ad-hoc
// QuizAttempts and stage practice — so the number stays meaningful as users
// move between the two.
export async function getUserStats(userId: string): Promise<{ accuracy: number; questionsSolved: number }> {
  const [attempts, stages] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      select: { correctCount: true, totalQuestions: true },
    }),
    prisma.userStageProgress.findMany({
      where: { userId },
      select: { correctAnswers: true, completedQuestions: true },
    }),
  ])

  let correct = 0
  let total = 0
  for (const a of attempts) {
    correct += a.correctCount
    total += a.totalQuestions
  }
  for (const s of stages) {
    correct += s.correctAnswers
    total += s.completedQuestions
  }

  return {
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    questionsSolved: total,
  }
}
