import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { safeQuestionSelect } from '@/lib/serializers'

type AttemptForQuestions = {
  id: number
  mode: 'FULL_PAPER' | 'CATEGORY_PRACTICE'
  questionPaperId: number | null
  sectionCategoryId?: number | null
  totalQuestions: number
}

// Unlike safeQuestionSelect, this reveals isCorrect/explanation — only usable
// once an attempt is complete (per-answer feedback and the results screen).
export const fullQuestionSelect = {
  id: true,
  questionNo: true,
  text: true,
  questionImage: true,
  explanation: true,
  revisionPoints: true,
  isVoided: true,
  difficulty: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  questionPaper: { select: { year: true } },
  options: {
    select: { id: true, label: true, text: true, imageUrl: true, isCorrect: true },
    orderBy: { label: 'asc' as const },
  },
} as const

// Past-paper questions are served in printed order (Q1, Q2, ...); id breaks
// ties for any question promoted before questionNo was recorded.
const paperOrder: Prisma.QuestionOrderByWithRelationInput[] = [
  { questionNo: { sort: 'asc', nulls: 'last' } },
  { id: 'asc' },
]

function paperWhere(attempt: AttemptForQuestions): Prisma.QuestionWhereInput {
  return {
    questionPaperId: attempt.questionPaperId!,
    ...(attempt.sectionCategoryId ? { categoryId: attempt.sectionCategoryId } : {}),
  }
}

async function resolveCategoryIds(attemptId: number): Promise<number[]> {
  const rows = await prisma.attemptCategory.findMany({ where: { attemptId }, select: { categoryId: true } })
  return rows.map((r) => r.categoryId)
}

export async function loadAttemptQuestionsSafe(attempt: AttemptForQuestions) {
  if (attempt.mode === 'FULL_PAPER') {
    return prisma.question.findMany({ where: paperWhere(attempt), orderBy: paperOrder, select: safeQuestionSelect })
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
    return prisma.question.findMany({ where: paperWhere(attempt), orderBy: paperOrder, select: fullQuestionSelect })
  }
  const categoryIds = await resolveCategoryIds(attempt.id)
  return prisma.question.findMany({
    where: { categoryId: { in: categoryIds } },
    orderBy: { id: 'asc' },
    take: attempt.totalQuestions,
    select: fullQuestionSelect,
  })
}
