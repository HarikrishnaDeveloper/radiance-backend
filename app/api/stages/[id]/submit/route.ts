import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeStars } from '@/lib/stage-progress'

type Context = { params: Promise<{ id: string }> }

type AnswerInput = { questionId: number; selectedOptionId: number | null; timeTaken?: number }

export async function POST(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const stageId = Number(id)
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ error: 'Invalid stage id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const answers: unknown = body?.answers
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'answers array is required' }, { status: 400 })
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      questions: {
        select: { question: { select: { id: true, isVoided: true, options: { select: { id: true, isCorrect: true } } } } },
      },
    },
  })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const questionsById = new Map(stage.questions.map((sq) => [sq.question.id, sq.question]))

  // Only answers for questions that actually belong to this stage are graded;
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

  const existingProgress = await prisma.userStageProgress.findUnique({
    where: { userId_stageId: { userId: user.id, stageId } },
    select: { status: true },
  })
  const firstCompletion = existingProgress?.status !== 'COMPLETED'

  await prisma.userStageProgress.upsert({
    where: { userId_stageId: { userId: user.id, stageId } },
    update: { completedQuestions, correctAnswers, accuracy, starsEarned, status: 'COMPLETED', completedAt: new Date() },
    create: {
      userId: user.id,
      stageId,
      completedQuestions,
      correctAnswers,
      accuracy,
      starsEarned,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })

  const nextStage = await prisma.stage.findUnique({
    where: { categoryId_stageNumber: { categoryId: stage.categoryId, stageNumber: stage.stageNumber + 1 } },
    select: { id: true, stageNumber: true },
  })

  return NextResponse.json({
    stageId,
    completedQuestions,
    correctAnswers,
    accuracy,
    starsEarned,
    firstCompletion,
    nextStageUnlocked: Boolean(nextStage),
    nextStageId: nextStage?.id ?? null,
    nextStageNumber: nextStage?.stageNumber ?? null,
  })
}
