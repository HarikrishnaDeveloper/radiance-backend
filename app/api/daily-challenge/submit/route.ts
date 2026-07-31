import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeStars } from '@/lib/stage-progress'
import { getOrCreateTodayChallenge } from '@/lib/daily-challenge'

type AnswerInput = { questionId: number; selectedOptionId: number | null; timeTaken?: number }

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const answers: unknown = body?.answers
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'answers array is required' }, { status: 400 })
  }

  const challenge = await getOrCreateTodayChallenge(prisma)

  const existing = await prisma.userDailyChallengeProgress.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
  })
  if (existing?.completedAt) {
    return NextResponse.json({ error: "Today's challenge is already completed" }, { status: 409 })
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: challenge.questions.map((q) => q.questionId) } },
    select: { id: true, isVoided: true, options: { select: { id: true, isCorrect: true } } },
  })
  const questionsById = new Map(questions.map((q) => [q.id, q]))

  // Only answers for questions that actually belong to today's challenge are graded;
  // anything else in the payload is ignored rather than rejected outright.
  const validAnswers = (answers as AnswerInput[]).filter(
    (a) => Number.isInteger(a?.questionId) && questionsById.has(a.questionId)
  )

  let correctAnswers = 0
  for (const answer of validAnswers) {
    const question = questionsById.get(answer.questionId)!
    const selectedOptionId =
      answer.selectedOptionId === null || answer.selectedOptionId === undefined ? null : Number(answer.selectedOptionId)
    const correctOption = question.options.find((o) => o.isCorrect)
    // Voided questions (no valid answer key) score as correct for everyone,
    // matching how UPSC scores dropped questions — same rule as attempts/answers.
    const isCorrect = question.isVoided || (selectedOptionId !== null && selectedOptionId === correctOption?.id)
    if (isCorrect) correctAnswers++

    await prisma.userQuestionProgress.upsert({
      where: { userId_questionId: { userId: user.id, questionId: answer.questionId } },
      update: {
        selectedOption: selectedOptionId,
        isCorrect,
        timeTaken: answer.timeTaken ?? null,
        attemptedAt: new Date(),
      },
      create: {
        userId: user.id,
        questionId: answer.questionId,
        selectedOption: selectedOptionId,
        isCorrect,
        timeTaken: answer.timeTaken ?? null,
      },
    })
  }

  const completedQuestions = validAnswers.length
  const accuracy = completedQuestions > 0 ? Math.round((correctAnswers / completedQuestions) * 100) : 0
  const starsEarned = computeStars(accuracy)

  await prisma.userDailyChallengeProgress.upsert({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
    update: { completedQuestions, correctAnswers, accuracy, starsEarned, completedAt: new Date() },
    create: {
      userId: user.id,
      challengeId: challenge.id,
      completedQuestions,
      correctAnswers,
      accuracy,
      starsEarned,
      completedAt: new Date(),
    },
  })

  return NextResponse.json({
    challengeId: challenge.id,
    completedQuestions,
    correctAnswers,
    accuracy,
    starsEarned,
  })
}
