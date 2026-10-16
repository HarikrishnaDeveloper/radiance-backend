import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ==========================================================================
// Leaderboard: ranks students purely on full-paper test marks. Only EXAM
// attempts of a whole paper count (PRACTICE reveals answers as you go, and a
// section isn't a paper). Marks already follow each paper's scheme (stored
// on completion — see lib/paper-test.ts); papers differ in length, so each
// attempt is normalised to score ÷ maxScore. A student's leaderboard score is
// the average of their best normalised result on each distinct paper.
// Practice volume, streaks and daily tasks never feed in.
// ==========================================================================

export type LeaderboardEntry = {
  rank: number
  userId: string
  name: string
  // Average best percentage across papers, 1 decimal. Can be negative —
  // UPSC negative marking applies.
  scorePercent: number
  papersAttempted: number
  isMe: boolean
}

export type Leaderboard = {
  top: LeaderboardEntry[]
  me: LeaderboardEntry | null
  totalRanked: number
}

type Row = { userId: string; rank: bigint; score: number; papers: bigint; fullName: string | null; name: string | null; username: string | null }

const RANKED = Prisma.sql`
  WITH best AS (
    SELECT qa."userId", qa."questionPaperId", MAX(qa.score / qa."maxScore") AS pct
    FROM "QuizAttempt" qa
    WHERE qa.mode = 'FULL_PAPER' AND qa."testMode" = 'EXAM' AND qa."sectionCategoryId" IS NULL
      AND qa."completedAt" IS NOT NULL AND qa.score IS NOT NULL AND qa."maxScore" > 0
    GROUP BY qa."userId", qa."questionPaperId"
  ), per_user AS (
    SELECT "userId", AVG(pct) * 100 AS score, COUNT(*) AS papers FROM best GROUP BY "userId"
  ), ranked AS (
    SELECT p.*, RANK() OVER (ORDER BY p.score DESC) AS rank FROM per_user p
  )
  SELECT r."userId", r.rank, r.score, r.papers, up."fullName", u.name, u.username
  FROM ranked r
  JOIN "User" u ON u.id = r."userId"
  LEFT JOIN "UserProfile" up ON up."userId" = u.id
`

// "Arjun Kumar" → "Arjun K." — enough to recognise yourself without
// publishing other students' full names.
function displayName(row: Row) {
  const full = (row.fullName || row.name || row.username || '').trim()
  if (!full) return 'Aspirant'
  const [first, ...rest] = full.split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

function toEntry(row: Row, myId: string): LeaderboardEntry {
  return {
    rank: Number(row.rank),
    userId: row.userId,
    name: displayName(row),
    scorePercent: Math.round(row.score * 10) / 10,
    papersAttempted: Number(row.papers),
    isMe: row.userId === myId,
  }
}

export async function getLeaderboard(userId: string, limit = 5): Promise<Leaderboard> {
  const [top, mine, total] = await Promise.all([
    prisma.$queryRaw<Row[]>`${RANKED} ORDER BY r.rank, r.papers DESC, r."userId" LIMIT ${limit}`,
    prisma.$queryRaw<Row[]>`${RANKED} WHERE r."userId" = ${userId}`,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId") AS count FROM "QuizAttempt"
      WHERE mode = 'FULL_PAPER' AND "testMode" = 'EXAM' AND "sectionCategoryId" IS NULL
        AND "completedAt" IS NOT NULL AND score IS NOT NULL AND "maxScore" > 0
    `,
  ])

  return {
    top: top.map((r) => toEntry(r, userId)),
    me: mine[0] ? toEntry(mine[0], userId) : null,
    totalRanked: Number(total[0]?.count ?? 0),
  }
}
