import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { loadAttemptQuestionsFull } from '@/lib/attempt-questions'
import { MARKS_CORRECT, MARKS_WRONG, maxScoreFor, roundMarks, scoreFor, sectionBreakdown } from '@/lib/paper-test'

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
  if (!attempt.completedAt) {
    return NextResponse.json({ error: 'Attempt is not completed yet' }, { status: 409 })
  }

  const [questions, answers] = await Promise.all([
    loadAttemptQuestionsFull(attempt),
    prisma.attemptAnswer.findMany({ where: { attemptId } }),
  ])
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]))

  return NextResponse.json({
    id: attempt.id,
    mode: attempt.mode,
    testMode: attempt.testMode,
    paper: attempt.questionPaper,
    section: attempt.sectionCategory,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    // Attempts completed before marks were stored are scored on read.
    score: attempt.score ?? scoreFor(attempt.correctCount, attempt.wrongCount),
    maxScore: attempt.maxScore ?? maxScoreFor(attempt.totalQuestions),
    marking: { correct: MARKS_CORRECT, wrong: roundMarks(MARKS_WRONG) },
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    timeTakenSeconds: Math.round((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000),
    durationSeconds: attempt.durationSeconds,
    scorePercent:
      attempt.totalQuestions > 0 ? Math.round((attempt.correctCount / attempt.totalQuestions) * 100) : 0,
    sections: sectionBreakdown(questions, answers),
    questions: questions.map((q) => {
      const answer = answerByQuestion.get(q.id)
      return {
        id: q.id,
        questionNo: q.questionNo,
        text: q.text,
        questionImage: q.questionImage ?? null,
        explanation: q.explanation,
        revisionPoints: q.revisionPoints,
        isVoided: q.isVoided,
        category: q.category,
        options: q.options,
        correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
        selectedOptionId: answer?.selectedOptionId ?? null,
        isCorrect: answer?.isCorrect ?? false,
      }
    }),
  })
}
