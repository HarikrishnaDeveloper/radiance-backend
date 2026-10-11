import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { DEADLINE_GRACE_SECONDS, examDeadline } from '@/lib/paper-test'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const attemptId = Number(id)
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 })
  }

  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  if (attempt.completedAt) {
    return NextResponse.json({ error: 'Attempt already completed' }, { status: 409 })
  }

  const deadline = examDeadline(attempt)
  if (deadline && Date.now() > deadline.getTime() + DEADLINE_GRACE_SECONDS * 1000) {
    return NextResponse.json({ error: 'TIME_UP' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const questionId = Number(body?.questionId)
  const selectedOptionId =
    body?.selectedOptionId === null || body?.selectedOptionId === undefined ? null : Number(body.selectedOptionId)

  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: true },
  })
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  if (attempt.mode === 'FULL_PAPER') {
    const inAttempt =
      question.questionPaperId === attempt.questionPaperId &&
      (!attempt.sectionCategoryId || question.categoryId === attempt.sectionCategoryId)
    if (!inAttempt) return NextResponse.json({ error: 'Question is not part of this attempt' }, { status: 400 })
  }
  if (selectedOptionId !== null && !question.options.some((o) => o.id === selectedOptionId)) {
    return NextResponse.json({ error: 'selectedOptionId does not belong to this question' }, { status: 400 })
  }

  const correctOption = question.options.find((o) => o.isCorrect)
  const feedback = {
    correctOptionId: correctOption?.id ?? null,
    explanation: question.explanation,
    revisionPoints: question.revisionPoints,
  }

  // A practice-mode paper reveals the answer as soon as one is chosen, so the
  // first choice is final — changing it afterwards would just copy the key.
  if (attempt.mode === 'FULL_PAPER' && attempt.testMode === 'PRACTICE') {
    const existing = await prisma.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
    })
    if (existing?.selectedOptionId != null) {
      return NextResponse.json({ isCorrect: existing.isCorrect, selectedOptionId: existing.selectedOptionId, ...feedback })
    }
  }

  // Voided questions (no valid answer key entry) count as correct for everyone,
  // regardless of selection — matching how UPSC itself scores dropped questions.
  const isCorrect = question.isVoided || (selectedOptionId !== null && selectedOptionId === correctOption?.id)

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { selectedOptionId, isCorrect, answeredAt: new Date() },
    create: { attemptId, questionId, selectedOptionId, isCorrect },
  })

  // EXAM mode is scored only on submission: acknowledge the save, reveal nothing.
  if (attempt.testMode === 'EXAM') {
    return NextResponse.json({ saved: true, selectedOptionId })
  }

  return NextResponse.json({ isCorrect, selectedOptionId, ...feedback })
}
