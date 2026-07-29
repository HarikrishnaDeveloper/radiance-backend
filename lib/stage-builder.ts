import type { PrismaClient } from '@prisma/client'

const QUESTIONS_PER_STAGE = 10

// Groups a category's questions into fixed batches of 10 and (re)creates the
// Stage/StageQuestion rows for it. Safe to re-run: each stage's question
// mapping is fully replaced from the current question set, and any stages
// left over from a previous run with more questions are removed (cascades
// to their StageQuestion rows; a user's UserStageProgress for a removed
// stage is lost, an acceptable edge case if a category's questions shrink).
export async function buildStagesForCategory(prisma: PrismaClient, categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) throw new Error(`Category ${categoryId} not found`)

  const questions = await prisma.question.findMany({
    where: { categoryId },
    orderBy: [{ questionPaper: { year: 'asc' } }, { id: 'asc' }],
    select: { id: true },
  })

  const chunks: { id: number }[][] = []
  for (let i = 0; i < questions.length; i += QUESTIONS_PER_STAGE) {
    chunks.push(questions.slice(i, i + QUESTIONS_PER_STAGE))
  }

  for (let i = 0; i < chunks.length; i++) {
    const stageNumber = i + 1
    const chunk = chunks[i]

    const stage = await prisma.stage.upsert({
      where: { categoryId_stageNumber: { categoryId, stageNumber } },
      update: { questionCount: chunk.length, foodWorldName: category.foodWorldName },
      create: {
        categoryId,
        stageNumber,
        title: `Stage ${stageNumber}`,
        foodWorldName: category.foodWorldName,
        questionCount: chunk.length,
        unlockOrder: stageNumber,
      },
    })

    await prisma.stageQuestion.deleteMany({ where: { stageId: stage.id } })
    await prisma.stageQuestion.createMany({
      data: chunk.map((q, index) => ({ stageId: stage.id, questionId: q.id, displayOrder: index })),
    })
  }

  // Drop stages left over from a previous run that no longer has enough
  // questions to fill them (cascades to their StageQuestion rows).
  await prisma.stage.deleteMany({ where: { categoryId, stageNumber: { gt: chunks.length } } })

  return { categoryId, categoryName: category.name, totalQuestions: questions.length, totalStages: chunks.length }
}

export async function buildAllStages(prisma: PrismaClient) {
  const categories = await prisma.category.findMany({ select: { id: true } })
  const results = []
  for (const category of categories) {
    results.push(await buildStagesForCategory(prisma, category.id))
  }
  return results
}
