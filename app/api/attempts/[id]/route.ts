import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { loadAttemptQuestionsSafe } from '@/lib/attempt-questions'
import { examDeadline } from '@/lib/paper-test'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const attemptId = Number(id)
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 })
  }

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: {
      questionPaper: { select: { id: true, year: true, title: true } },
      sectionCategory: { select: { id: true, name: true } },
    },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

  const [questions, answers] = await Promise.all([
    loadAttemptQuestionsSafe(attempt),
    prisma.attemptAnswer.findMany({
      where: { attemptId },
      select: {
        questionId: true,
        selectedOptionId: true,
        isCorrect: true,
        question: {
          select: { explanation: true, revisionPoints: true, options: { where: { isCorrect: true }, select: { id: true } } },
        },
      },
    }),
  ])

  // An unfinished EXAM attempt must not reveal which saved answers are right.
  // PRACTICE attempts already showed feedback per question, so a resumed one
  // gets it back for everything answered so far.
  const hideFeedback = attempt.testMode === 'EXAM' && !attempt.completedAt
  const deadline = examDeadline(attempt)

  return NextResponse.json({
    id: attempt.id,
    mode: attempt.mode,
    testMode: attempt.testMode,
    totalQuestions: attempt.totalQuestions,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    durationSeconds: attempt.durationSeconds,
    deadline,
    serverNow: new Date(),
    paper: attempt.questionPaper,
    section: attempt.sectionCategory,
    questions,
    answers: answers.map((a) =>
      hideFeedback
        ? { questionId: a.questionId, selectedOptionId: a.selectedOptionId }
        : {
            questionId: a.questionId,
            selectedOptionId: a.selectedOptionId,
            isCorrect: a.isCorrect,
            correctOptionId: a.question.options[0]?.id ?? null,
            explanation: a.question.explanation,
            revisionPoints: a.question.revisionPoints,
          }
    ),
  })
}
