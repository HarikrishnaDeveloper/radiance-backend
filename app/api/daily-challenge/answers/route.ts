import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getOrCreateTodayChallenge } from '@/lib/daily-challenge'

// Checks one answer in today's challenge and returns the correct option,
// explanation and review points — shown whether the answer was right, wrong
// or skipped. The answer is recorded immediately; the submit route grades
// from these recorded answers, so a revealed answer can't be changed.
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const questionId = Number(body?.questionId)
  const selectedOptionId =
    body?.selectedOptionId === null || body?.selectedOptionId === undefined ? null : Number(body.selectedOptionId)
  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  }

  const challenge = await getOrCreateTodayChallenge(prisma)
  if (!challenge.questions.some((q) => q.questionId === questionId)) {
    return NextResponse.json({ error: "Question is not part of today's challenge" }, { status: 400 })
  }

  // First answer of the day starts the challenge; its startedAt bounds which
  // recorded answers count toward it.
  const progress = await prisma.userDailyChallengeProgress.upsert({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
    update: {},
    create: { userId: user.id, challengeId: challenge.id },
  })
  if (progress.completedAt) {
    return NextResponse.json({ error: "Today's challenge is already completed" }, { status: 409 })
  }

  const question = await prisma.question.findUnique({ where: { id: questionId }, include: { options: true } })
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if (selectedOptionId !== null && !question.options.some((o) => o.id === selectedOptionId)) {
    return NextResponse.json({ error: 'selectedOptionId does not belong to this question' }, { status: 400 })
  }

  const correctOption = question.options.find((o) => o.isCorrect)
  const feedback = {
    correctOptionId: correctOption?.id ?? null,
    explanation: question.explanation,
    revisionPoints: question.revisionPoints,
  }

  // Already answered during this challenge: return the recorded result.
  const recorded = await prisma.userQuestionProgress.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  })
  if (recorded && recorded.attemptedAt >= progress.startedAt) {
    return NextResponse.json({ isCorrect: recorded.isCorrect, selectedOptionId: recorded.selectedOption, ...feedback })
  }

  // Voided questions count as correct for everyone — same rule as every other mode.
  const isCorrect = question.isVoided || (selectedOptionId !== null && selectedOptionId === correctOption?.id)
  await prisma.userQuestionProgress.upsert({
    where: { userId_questionId: { userId: user.id, questionId } },
    update: { selectedOption: selectedOptionId, isCorrect, attemptedAt: new Date() },
    create: { userId: user.id, questionId, selectedOption: selectedOptionId, isCorrect },
  })

  return NextResponse.json({ isCorrect, selectedOptionId, ...feedback })
}
