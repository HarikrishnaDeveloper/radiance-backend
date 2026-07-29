import { prisma } from '@/lib/prisma'

// Category list enriched with stage-mode progress, shared by /api/categories
// and the dashboard so the two don't drift.
export async function getCategoryProgress(userId: string) {
  const categories = await prisma.category.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { questions: true, stages: true } } },
  })

  const completedRows = await prisma.userStageProgress.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      stage: { categoryId: { in: categories.map((c) => c.id) } },
    },
    select: { stage: { select: { categoryId: true } } },
  })

  const completedByCategory = new Map<number, number>()
  for (const row of completedRows) {
    const categoryId = row.stage.categoryId
    completedByCategory.set(categoryId, (completedByCategory.get(categoryId) ?? 0) + 1)
  }

  return categories.map((c) => {
    const totalStages = c._count.stages
    const completedStages = completedByCategory.get(c.id) ?? 0
    return {
      id: c.id,
      name: c.name,
      foodWorldName: c.foodWorldName,
      icon: c.icon,
      color: c.color,
      questionCount: c._count.questions,
      totalStages,
      completedStages,
      progress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    }
  })
}
