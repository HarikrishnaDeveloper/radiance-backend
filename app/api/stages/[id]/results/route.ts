import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type Context = { params: Promise<{ id: string }> }

// Per-question review for a stage the user has already completed. Answer
// correctness/selection is read from UserQuestionProgress — accurate as long
// as the user reviews before re-answering the same questions elsewhere
// (e.g. a category-practice attempt touching the same question bank).
export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const stageId = Number(id)
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ error: 'Invalid stage id' }, { status: 400 })
  }

  const progress = await prisma.userStageProgress.findUnique({
    where: { userId_stageId: { userId: user.id, stageId } },
  })
  if (!progress || progress.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Complete this stage before reviewing its answers' }, { status: 403 })
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      category: { select: { id: true, name: true } },
      questions: {
        orderBy: { displayOrder: 'asc' },
        select: {
          question: {
            select: {
              id: true,
              text: true,
              questionImage: true,
              explanation: true,
              options: {
                select: { id: true, label: true, text: true, isCorrect: true },
                orderBy: { label: 'asc' as const },
              },
            },
          },
        },
      },
    },
  })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const questionIds = stage.questions.map((sq) => sq.question.id)
  const userProgress = await prisma.userQuestionProgress.findMany({
    where: { userId: user.id, questionId: { in: questionIds } },
    select: { questionId: true, selectedOption: true, isCorrect: true },
  })
  const progressByQuestion = new Map(userProgress.map((p) => [p.questionId, p]))

  return NextResponse.json({
    stageId: stage.id,
    stageNumber: stage.stageNumber,
    foodWorldName: stage.foodWorldName,
    category: stage.category,
    accuracy: progress.accuracy,
    correctAnswers: progress.correctAnswers,
    completedQuestions: progress.completedQuestions,
    questions: stage.questions.map((sq) => {
      const p = progressByQuestion.get(sq.question.id)
      return {
        id: sq.question.id,
        text: sq.question.text,
        questionImage: sq.question.questionImage,
        explanation: sq.question.explanation,
        options: sq.question.options,
        selectedOptionId: p?.selectedOption ?? null,
        isCorrect: p?.isCorrect ?? false,
      }
    }),
  })
}
