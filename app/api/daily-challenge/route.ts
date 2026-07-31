import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { safeQuestionSelect } from '@/lib/serializers'
import { getOrCreateTodayChallenge } from '@/lib/daily-challenge'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const challenge = await getOrCreateTodayChallenge(prisma)

  const [questions, progress] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: challenge.questions.map((q) => q.questionId) } },
      select: safeQuestionSelect,
    }),
    prisma.userDailyChallengeProgress.findUnique({
      where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
    }),
  ])

  const questionsById = new Map(questions.map((q) => [q.id, q]))
  const orderedQuestions = challenge.questions.map((cq) => questionsById.get(cq.questionId)).filter(Boolean)

  return NextResponse.json({
    id: challenge.id,
    questionCount: challenge.questionCount,
    questions: orderedQuestions,
    progress: progress
      ? {
          completedQuestions: progress.completedQuestions,
          correctAnswers: progress.correctAnswers,
          accuracy: progress.accuracy,
          starsEarned: progress.starsEarned,
          completedAt: progress.completedAt,
        }
      : null,
  })
}
