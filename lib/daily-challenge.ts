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

  const allQuestions = await prisma.question.findMany({ select: { id: true } })
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
