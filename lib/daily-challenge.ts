import { Prisma, type PrismaClient } from '@prisma/client'

const QUESTIONS_PER_CHALLENGE = 10

function todayDateKey(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

// Small deterministic PRNG (mulberry32) seeded from the date string, so every
// user gets the exact same 10 "random" questions on a given day.
function seededShuffle<T>(items: T[], seedStr: string): T[] {
  let seed = 0
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0
  }
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const challengeInclude = { questions: { orderBy: { displayOrder: 'asc' as const } } }

export async function getOrCreateTodayChallenge(prisma: PrismaClient) {
  const challengeDate = todayDateKey()

  const existing = await prisma.dailyChallenge.findUnique({
    where: { challengeDate },
    include: challengeInclude,
  })
  if (existing) return existing

  // Detached, superseded copies (questionPaperId null) are never picked.
  const allQuestions = await prisma.question.findMany({ where: { questionPaperId: { not: null } }, select: { id: true } })
  const picked = seededShuffle(allQuestions, challengeDate.toISOString()).slice(0, QUESTIONS_PER_CHALLENGE)

  try {
    return await prisma.dailyChallenge.create({
      data: {
        challengeDate,
        questionCount: picked.length,
        questions: {
          create: picked.map((q, index) => ({ questionId: q.id, displayOrder: index })),
        },
      },
      include: challengeInclude,
    })
  } catch (e) {
    // Another request created today's challenge in the gap between the findUnique
    // and this create — fall back to reading what won the race.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return prisma.dailyChallenge.findUniqueOrThrow({ where: { challengeDate }, include: challengeInclude })
    }
    throw e
  }
}

// The answer key and notes for a question shown in today's challenge.
export const challengeReviewSelect = {
  id: true,
  questionNo: true,
  text: true,
  questionImage: true,
  explanation: true,
  revisionPoints: true,
  isVoided: true,
  category: { select: { id: true, name: true } },
  questionPaper: { select: { year: true } },
  options: { select: { id: true, label: true, text: true, isCorrect: true }, orderBy: { label: 'asc' as const } },
} as const

// Each challenge question with the user's answer, the correct option,
// explanation and review points — the per-question review shown once today's
// challenge is finished. Answers come from UserQuestionProgress rows written
// since the user started the challenge (`since`).
export async function getChallengeReview(
  prisma: PrismaClient,
  userId: string,
  challenge: { questions: { questionId: number }[] },
  since: Date
) {
  const ids = challenge.questions.map((q) => q.questionId)
  const [questions, progress] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: ids } }, select: challengeReviewSelect }),
    prisma.userQuestionProgress.findMany({
      where: { userId, questionId: { in: ids }, attemptedAt: { gte: since } },
      select: { questionId: true, selectedOption: true, isCorrect: true },
    }),
  ])
  const byId = new Map(questions.map((q) => [q.id, q]))
  const answerById = new Map(progress.map((p) => [p.questionId, p]))

  return ids.flatMap((id) => {
    const q = byId.get(id)
    if (!q) return []
    const answer = answerById.get(id)
    return [
      {
        ...q,
        correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
        selectedOptionId: answer?.selectedOption ?? null,
        isCorrect: answer ? answer.isCorrect : q.isVoided,
      },
    ]
  })
}
