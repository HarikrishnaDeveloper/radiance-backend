import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { safeQuestionSelect } from '@/lib/serializers'

type Context = { params: Promise<{ id: string }> }

const REWARD_THRESHOLDS = { threeStars: 100, twoStars: 80, oneStar: 60 }

export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const stageId = Number(id)
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ error: 'Invalid stage id' }, { status: 400 })
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      category: { select: { id: true, name: true } },
      questions: {
        orderBy: { displayOrder: 'asc' },
        select: { displayOrder: true, question: { select: safeQuestionSelect } },
      },
    },
  })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const progress = await prisma.userStageProgress.findUnique({
    where: { userId_stageId: { userId: user.id, stageId } },
  })

  return NextResponse.json({
    id: stage.id,
    stageNumber: stage.stageNumber,
    title: stage.title,
    foodWorldName: stage.foodWorldName,
    questionCount: stage.questionCount,
    rewardStars: stage.rewardStars,
    category: stage.category,
    rewardThresholds: REWARD_THRESHOLDS,
    progress: progress
      ? {
          status: progress.status,
          completedQuestions: progress.completedQuestions,
          correctAnswers: progress.correctAnswers,
          accuracy: progress.accuracy,
          starsEarned: progress.starsEarned,
        }
      : null,
    questions: stage.questions.map((sq) => sq.question),
  })
}
