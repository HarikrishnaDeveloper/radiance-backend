import { prisma } from '@/lib/prisma'

type ContinueLearning =
  | {
      allCompleted: false
      categoryId: number
      categoryName: string
      foodWorldName: string | null
      stageId: number
      stageNumber: number
      questionProgress: { completed: number; total: number }
      resumeUrl: string
    }
  | { allCompleted: true }

// Resume-where-you-left-off logic shared by /api/users/me/continue and the
// dashboard: prefer an in-progress stage, otherwise the first stage (in
// category display order, then stage order) the user hasn't completed yet.
export async function getContinueLearning(userId: string): Promise<ContinueLearning> {
  const inProgress = await prisma.userStageProgress.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    include: { stage: { include: { category: true } } },
  })

  if (inProgress) {
    return {
      allCompleted: false,
      categoryId: inProgress.stage.categoryId,
      categoryName: inProgress.stage.category.name,
      foodWorldName: inProgress.stage.foodWorldName,
      stageId: inProgress.stageId,
      stageNumber: inProgress.stage.stageNumber,
      questionProgress: { completed: inProgress.completedQuestions, total: inProgress.stage.questionCount },
      resumeUrl: `/stage/${inProgress.stageId}`,
    }
  }

  const stages = await prisma.stage.findMany({
    where: { isPublished: true, category: { isActive: true } },
    include: { category: true },
  })
  if (stages.length === 0) return { allCompleted: true }

  stages.sort((a, b) => {
    if (a.category.displayOrder !== b.category.displayOrder) return a.category.displayOrder - b.category.displayOrder
    if (a.categoryId !== b.categoryId) return a.category.name.localeCompare(b.category.name)
    return a.stageNumber - b.stageNumber
  })

  const completedStageIds = new Set(
    (
      await prisma.userStageProgress.findMany({
        where: { userId, status: 'COMPLETED', stageId: { in: stages.map((s) => s.id) } },
        select: { stageId: true },
      })
    ).map((r) => r.stageId)
  )

  const nextStage = stages.find((s) => !completedStageIds.has(s.id))
  if (!nextStage) return { allCompleted: true }

  return {
    allCompleted: false,
    categoryId: nextStage.categoryId,
    categoryName: nextStage.category.name,
    foodWorldName: nextStage.foodWorldName,
    stageId: nextStage.id,
    stageNumber: nextStage.stageNumber,
    questionProgress: { completed: 0, total: nextStage.questionCount },
    resumeUrl: `/stage/${nextStage.id}`,
  }
}
