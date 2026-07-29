import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: { select: { questions: true } },
      stages: { where: { isPublished: true }, orderBy: { stageNumber: 'asc' } },
    },
  })
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  const progressRows = await prisma.userStageProgress.findMany({
    where: { userId: user.id, stageId: { in: category.stages.map((s) => s.id) } },
  })
  const progressByStageId = new Map(progressRows.map((row) => [row.stageId, row]))

  let previousCompleted = true // stage 1 is always unlocked
  const stages = category.stages.map((stage) => {
    const progress = progressByStageId.get(stage.id)
    const status = progress ? progress.status : previousCompleted ? 'UNLOCKED' : 'LOCKED'
    previousCompleted = status === 'COMPLETED'

    return {
      id: stage.id,
      stageNumber: stage.stageNumber,
      title: stage.title,
      questionCount: stage.questionCount,
      rewardStars: stage.rewardStars,
      status,
      starsEarned: progress?.starsEarned ?? 0,
      accuracy: progress?.accuracy ?? 0,
    }
  })

  const totalStages = stages.length
  const completedStages = stages.filter((s) => s.status === 'COMPLETED').length

  return NextResponse.json({
    id: category.id,
    name: category.name,
    foodWorldName: category.foodWorldName,
    icon: category.icon,
    color: category.color,
    questionCount: category._count.questions,
    totalStages,
    completedStages,
    completionPercentage: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    stages,
  })
}
