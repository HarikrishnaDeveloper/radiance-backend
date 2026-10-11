import type { TestMode } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasFullAccess } from '@/lib/entitlement'

// ==========================================================================
// Previous-year paper tests: the rules for taking a past UPSC Prelims paper
// (whole paper or one subject section) in EXAM or PRACTICE mode.
// ==========================================================================

// UPSC Prelims GS marking: +2 for a correct answer, minus one third of that
// for a wrong one, 0 for an unattempted question. Voided questions earn the
// full +2 for everyone, as UPSC awards when it drops a question.
export const MARKS_CORRECT = 2
export const MARKS_WRONG = -2 / 3

// Every GS Paper I sitting is two hours, whether it had 150 questions (pre-2011)
// or 100. A section gets the same time per question as its full paper.
export const PAPER_DURATION_SECONDS = 2 * 60 * 60
const MIN_SECTION_DURATION_SECONDS = 5 * 60

// An answer saved this long after the EXAM deadline is still accepted, to
// absorb network latency on the client's final auto-save.
export const DEADLINE_GRACE_SECONDS = 30

export function sectionDurationSeconds(sectionQuestions: number, paperQuestions: number) {
  if (paperQuestions <= 0 || sectionQuestions >= paperQuestions) return PAPER_DURATION_SECONDS
  const proportional = (PAPER_DURATION_SECONDS * sectionQuestions) / paperQuestions
  // Rounded up to a whole minute so the timer starts on a clean value.
  return Math.max(MIN_SECTION_DURATION_SECONDS, Math.ceil(proportional / 60) * 60)
}

export function roundMarks(marks: number) {
  return Math.round(marks * 100) / 100
}

export function scoreFor(correct: number, wrong: number) {
  return roundMarks(correct * MARKS_CORRECT + wrong * MARKS_WRONG)
}

export function maxScoreFor(totalQuestions: number) {
  return totalQuestions * MARKS_CORRECT
}

// When an EXAM attempt stops accepting answers, or null if it has no limit.
export function examDeadline(attempt: { testMode: TestMode; startedAt: Date; durationSeconds: number | null }) {
  if (attempt.testMode !== 'EXAM' || !attempt.durationSeconds) return null
  return new Date(attempt.startedAt.getTime() + attempt.durationSeconds * 1000)
}

// The newest paper is the free sample; every older year needs a subscription.
export async function latestPaperYear(): Promise<number | null> {
  const latest = await prisma.questionPaper.findFirst({ orderBy: { year: 'desc' }, select: { year: true } })
  return latest?.year ?? null
}

export async function canAccessPaper(userId: string, paperYear: number): Promise<boolean> {
  if (paperYear === (await latestPaperYear())) return true
  return hasFullAccess(userId)
}

export type PaperSection = { categoryId: number; name: string; questionCount: number; durationSeconds: number }

// A paper's subject sections, derived from its questions' categories, ordered
// by size so the biggest subjects come first.
export async function loadPaperSections(questionPaperId: number): Promise<{ total: number; sections: PaperSection[] }> {
  const groups = await prisma.question.groupBy({
    by: ['categoryId'],
    where: { questionPaperId },
    _count: { _all: true },
  })
  const categories = await prisma.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  })
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const total = groups.reduce((sum, g) => sum + g._count._all, 0)

  const sections = groups
    .map((g) => ({
      categoryId: g.categoryId,
      name: nameById.get(g.categoryId) ?? 'Other',
      questionCount: g._count._all,
      durationSeconds: sectionDurationSeconds(g._count._all, total),
    }))
    .sort((a, b) => b.questionCount - a.questionCount || a.name.localeCompare(b.name))

  return { total, sections }
}

type ScoredQuestion = { id: number; categoryId: number; category: { id: number; name: string } }
type ScoredAnswer = { questionId: number; selectedOptionId: number | null; isCorrect: boolean }

// Per-subject correct/wrong/skipped tallies and marks for a finished attempt.
export function sectionBreakdown(questions: ScoredQuestion[], answers: ScoredAnswer[]) {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]))
  const rows = new Map<number, { categoryId: number; name: string; total: number; correct: number; wrong: number; skipped: number }>()

  for (const q of questions) {
    let row = rows.get(q.categoryId)
    if (!row) {
      row = { categoryId: q.categoryId, name: q.category.name, total: 0, correct: 0, wrong: 0, skipped: 0 }
      rows.set(q.categoryId, row)
    }
    const answer = answerByQuestion.get(q.id)
    row.total++
    if (answer?.isCorrect) row.correct++
    else if (answer?.selectedOptionId != null) row.wrong++
    else row.skipped++
  }

  return [...rows.values()]
    .map((r) => ({
      ...r,
      score: scoreFor(r.correct, r.wrong),
      maxScore: maxScoreFor(r.total),
      accuracy: r.correct + r.wrong > 0 ? Math.round((r.correct / (r.correct + r.wrong)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}
