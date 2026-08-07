import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const stageId = Number(id)
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ error: 'Invalid stage id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const questionId = Number(body?.questionId)
  const selectedOptionId =
    body?.selectedOptionId === null || body?.selectedOptionId === undefined ? null : Number(body.selectedOptionId)

  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  }

  const stageQuestion = await prisma.stageQuestion.findUnique({
    where: { stageId_questionId: { stageId, questionId } },
  })
  if (!stageQuestion) return NextResponse.json({ error: 'Question not found in this stage' }, { status: 404 })

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: true },
  })
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const correctOption = question.options.find((o) => o.isCorrect)
  // Voided questions (no valid answer key entry) count as correct for everyone,
  // regardless of selection — same rule as attempts/answers and stages/submit.
  const isCorrect = question.isVoided || (selectedOptionId !== null && selectedOptionId === correctOption?.id)

  await prisma.userQuestionProgress.upsert({
    where: { userId_questionId: { userId: user.id, questionId } },
    update: { selectedOption: selectedOptionId, isCorrect, attemptedAt: new Date() },
    create: { userId: user.id, questionId, selectedOption: selectedOptionId, isCorrect },
  })

  return NextResponse.json({
    isCorrect,
    correctOptionId: correctOption?.id ?? null,
    explanation: question.explanation,
  })
}
