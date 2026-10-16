import { prisma } from '@/lib/prisma'

// A subject is only rated once the user has answered this many of its
// questions — below that, one unlucky answer would brand it a weak area.
export const MIN_ANSWERS_TO_RATE = 10
// Rated subjects at or above this accuracy are "strong", below WEAK_BELOW "weak";
// anything in between is neither and simply isn't surfaced.
const STRONG_FROM = 70
const WEAK_BELOW = 60
const LIMIT = 3

export type CategoryScore = { categoryId: number; name: string; answered: number; correct: number; accuracy: number }

export type PerformanceSummary = {
  questionsSolved: number
  // correct ÷ (correct + incorrect) × 100 — skipped questions don't count either way.
  accuracy: number
  strong: CategoryScore[]
  weak: CategoryScore[]
  ratedCategories: number
  minAnswersToRate: number
}

// Every answer the user has given, grouped by subject: stage and
// daily-challenge answers (UserQuestionProgress) plus answers in finished
// paper/practice attempts (AttemptAnswer). Skipped and voided questions are
// excluded, so `answered` is correct + incorrect.
async function categoryScores(userId: string): Promise<CategoryScore[]> {
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
  `

  return rows.map((r) => {
    const answered = Number(r.answered)
    const correct = Number(r.correct)
    return {
      categoryId: r.categoryId,
      name: r.name,
      answered,
      correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    }
  })
}

// Headline practice numbers plus the subject-wise strong/weak split for the
// home screen, from one pass over the user's answers.
export async function getPerformanceSummary(userId: string): Promise<PerformanceSummary> {
  const scores = await categoryScores(userId)

  let answered = 0
  let correct = 0
  for (const s of scores) {
    answered += s.answered
    correct += s.correct
  }

  const rated = scores.filter((s) => s.answered >= MIN_ANSWERS_TO_RATE)
  const strong = rated
    .filter((s) => s.accuracy >= STRONG_FROM)
    .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)
    .slice(0, LIMIT)
  const weak = rated
    .filter((s) => s.accuracy < WEAK_BELOW)
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, LIMIT)

  return {
    questionsSolved: answered,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    strong,
    weak,
    ratedCategories: rated.length,
    minAnswersToRate: MIN_ANSWERS_TO_RATE,
  }
}
