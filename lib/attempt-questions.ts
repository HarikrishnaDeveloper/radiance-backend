import { prisma } from '@/lib/prisma'
import { safeQuestionSelect } from '@/lib/serializers'

type AttemptForQuestions = {
  id: number
  mode: 'FULL_PAPER' | 'CATEGORY_PRACTICE'
  questionPaperId: number | null
  totalQuestions: number
}

// Unlike safeQuestionSelect, this reveals isCorrect/explanation — only usable
// once an attempt is complete (per-answer feedback and the results screen).
const fullQuestionSelect = {
  id: true,
  text: true,
  explanation: true,
  isVoided: true,
  category: { select: { id: true, name: true } },
  options: {
    select: { id: true, label: true, text: true, isCorrect: true },
    orderBy: { label: 'asc' as const },
  },
} as const

async function resolveCategoryIds(attemptId: number): Promise<number[]> {
  const rows = await prisma.attemptCategory.findMany({ where: { attemptId }, select: { categoryId: true } })
  return rows.map((r) => r.categoryId)
}

export async function loadAttemptQuestionsSafe(attempt: AttemptForQuestions) {
  if (attempt.mode === 'FULL_PAPER') {
    return prisma.question.findMany({
      where: { questionPaperId: attempt.questionPaperId! },
      orderBy: { id: 'asc' },
      select: safeQuestionSelect,
    })
  }
  const categoryIds = await resolveCategoryIds(attempt.id)
  return prisma.question.findMany({
    where: { categoryId: { in: categoryIds } },
    orderBy: { id: 'asc' },
    take: attempt.totalQuestions,
    select: safeQuestionSelect,
  })
}

export async function loadAttemptQuestionsFull(attempt: AttemptForQuestions) {
  if (attempt.mode === 'FULL_PAPER') {
    return prisma.question.findMany({
      where: { questionPaperId: attempt.questionPaperId! },
      orderBy: { id: 'asc' },
      select: fullQuestionSelect,
    })
  }
  const categoryIds = await resolveCategoryIds(attempt.id)
  return prisma.question.findMany({
    where: { categoryId: { in: categoryIds } },
    orderBy: { id: 'asc' },
    take: attempt.totalQuestions,
    select: fullQuestionSelect,
  })
}
