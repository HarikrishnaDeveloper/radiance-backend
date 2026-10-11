import { prisma } from '@/lib/prisma'

// A subject is only rated once the user has answered this many of its
// questions — below that, one unlucky answer would brand it a weak area.
const MIN_ANSWERS = 5
const LIMIT = 3

export type WeakArea = { categoryId: number; name: string; answered: number; accuracy: number }

// The user's lowest-accuracy subjects, from every answer they've given:
// stage and daily-challenge answers (UserQuestionProgress) plus answers in
// finished paper/practice attempts (AttemptAnswer). Skipped and voided
// questions don't count either way.
export async function getWeakAreas(userId: string): Promise<WeakArea[]> {
  const rows = await prisma.$queryRaw<{ categoryId: number; name: string; answered: bigint; correct: bigint }[]>`
    WITH answers AS (
      SELECT uqp."questionId", uqp."isCorrect"
      FROM "UserQuestionProgress" uqp
      WHERE uqp."userId" = ${userId} AND uqp."selectedOption" IS NOT NULL
      UNION ALL
      SELECT aa."questionId", aa."isCorrect"
      FROM "AttemptAnswer" aa
      JOIN "QuizAttempt" qa ON qa.id = aa."attemptId"
      WHERE qa."userId" = ${userId} AND qa."completedAt" IS NOT NULL AND aa."selectedOptionId" IS NOT NULL
    )
    SELECT c.id AS "categoryId", c.name,
           COUNT(*) AS answered,
           COUNT(*) FILTER (WHERE a."isCorrect") AS correct
    FROM answers a
    JOIN "Question" q ON q.id = a."questionId" AND NOT q."isVoided"
    JOIN "Category" c ON c.id = q."categoryId"
    GROUP BY c.id, c.name
    HAVING COUNT(*) >= ${MIN_ANSWERS}
  `

  return rows
    .map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      answered: Number(r.answered),
      accuracy: Math.round((Number(r.correct) / Number(r.answered)) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, LIMIT)
}
