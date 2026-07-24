import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

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

  const correctOption = question.options.find((o) => o.isCorrect)
  // Voided questions (no valid answer key entry) count as correct for everyone,
  // regardless of selection — matching how UPSC itself scores dropped questions.
  const isCorrect = question.isVoided || (selectedOptionId !== null && selectedOptionId === correctOption?.id)

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { selectedOptionId, isCorrect },
    create: { attemptId, questionId, selectedOptionId, isCorrect },
  })

  return NextResponse.json({
    isCorrect,
    correctOptionId: correctOption?.id ?? null,
    explanation: question.explanation,
  })
}
