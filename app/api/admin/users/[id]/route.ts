import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { FREE_STAGE_LIMIT } from '@/lib/entitlement'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      subscription: true,
      payments: { orderBy: { paidAt: 'desc' }, take: 50 },
      _count: { select: { attempts: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const [completedStages, stageRows, questionStats, bookmarks, recentAttempts, challengesCompleted, goals] = await Promise.all([
    prisma.userStageProgress.count({ where: { userId: id, status: 'COMPLETED' } }),
    prisma.userStageProgress.findMany({
      where: { userId: id },
      select: { status: true, accuracy: true, starsEarned: true, stage: { select: { category: { select: { name: true } } } } },
    }),
    prisma.userQuestionProgress.groupBy({ by: ['isCorrect'], where: { userId: id }, _count: { _all: true } }),
    prisma.userQuestionProgress.count({ where: { userId: id, bookmarked: true } }),
    prisma.quizAttempt.findMany({
      where: { userId: id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        questionPaper: { select: { year: true, examType: { select: { name: true } } } },
        sectionCategory: { select: { name: true } },
      },
    }),
    prisma.userDailyChallengeProgress.count({ where: { userId: id, completedAt: { not: null } } }),
    prisma.studyPlanGoal.findMany({ where: { userId: id }, select: { type: true, target: true }, orderBy: { type: 'asc' } }),
  ])

  // Stage progress per subject, for the "Learning" section of the user page.
  const bySubject = new Map<string, { subject: string; started: number; completed: number; stars: number; accuracySum: number }>()
  for (const row of stageRows) {
    const subject = row.stage.category.name
    const entry = bySubject.get(subject) ?? { subject, started: 0, completed: 0, stars: 0, accuracySum: 0 }
    entry.started++
    if (row.status === 'COMPLETED') entry.completed++
    entry.stars += row.starsEarned
    entry.accuracySum += row.accuracy
    bySubject.set(subject, entry)
  }
  const answered = questionStats.reduce((n, g) => n + g._count._all, 0)
  const correct = questionStats.find((g) => g.isCorrect)?._count._all ?? 0

  return NextResponse.json({
    id: user.id,
    username: user.username,
    phone: user.phone,
    email: user.email,
    name: user.name,
    state: user.state,
    profileCompleted: user.profileCompleted,
    profile: user.profile ? {
      fullName: user.profile.fullName,
      targetExam: user.profile.targetExam,
      preparationLevel: user.profile.preparationLevel,
      targetAttempt: user.profile.targetAttempt,
      preparationFocus: user.profile.preparationFocus,
      referralSource: user.profile.referralSource,
      preparationDuration: user.profile.preparationDuration,
    } : null,
    dateOfBirth: user.dateOfBirth,
    phoneVerifiedAt: user.phoneVerifiedAt,
    learning: {
      questionsAnswered: answered,
      questionsCorrect: correct,
      bookmarks,
      dailyChallengesCompleted: challengesCompleted,
      streakFreezesAvailable: user.streakFreezesAvailable,
      streakFreezesUsed: user.streakFreezesUsed,
      goals,
      subjects: [...bySubject.values()]
        .map(({ accuracySum, ...s }) => ({ ...s, accuracy: s.started ? accuracySum / s.started : 0 }))
        .sort((a, b) => b.started - a.started),
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        mode: a.mode,
        testMode: a.testMode,
        paper: a.questionPaper ? { year: a.questionPaper.year, name: a.questionPaper.examType.name } : null,
        section: a.sectionCategory?.name ?? null,
        totalQuestions: a.totalQuestions,
        correctCount: a.correctCount,
        wrongCount: a.wrongCount,
        score: a.score,
        maxScore: a.maxScore,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      })),
    },
    isTestUser: user.isTestUser,
    isPremium: user.isPremium,
    createdAt: user.createdAt,
    completedStages,
    quizAttempts: user._count.attempts,
    subscription: user.subscription
      ? {
          id: user.subscription.id,
          status: user.subscription.status,
          razorpaySubscriptionId: user.subscription.razorpaySubscriptionId,
          currentStart: user.subscription.currentStart,
          currentEnd: user.subscription.currentEnd,
          chargeAt: user.subscription.chargeAt,
          paidCount: user.subscription.paidCount,
          activatedAt: user.subscription.activatedAt,
          cancelledAt: user.subscription.cancelledAt,
        }
      : null,
    freeStageLimit: FREE_STAGE_LIMIT,
    payments: user.payments.map((p) => ({
      id: p.id,
      razorpayPaymentId: p.razorpayPaymentId,
      amountPaise: p.amountPaise,
      currency: p.currency,
      status: p.status,
      method: p.method,
      paidAt: p.paidAt,
    })),
  })
}

export async function PATCH(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const body = await request.json().catch(() => null)
  const data: { isTestUser?: boolean; isPremium?: boolean } = {}
  if (typeof body?.isTestUser === 'boolean') data.isTestUser = body.isTestUser
  if (typeof body?.isPremium === 'boolean') data.isPremium = body.isPremium

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({ where: { id }, data })
  return NextResponse.json({ id: updated.id, isTestUser: updated.isTestUser, isPremium: updated.isPremium })
}
