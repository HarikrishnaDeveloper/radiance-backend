import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const papers = await prisma.paper.findMany({
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { questions: true } } },
  })

  const needsReviewByPaper = await prisma.draftQuestion.groupBy({
    by: ['paperId'],
    where: { status: 'NEEDS_REVIEW' },
    _count: { _all: true },
  })
  const needsReviewMap = new Map(needsReviewByPaper.map((row) => [row.paperId, row._count._all]))

  return NextResponse.json(
    papers.map((paper) => ({
      id: paper.id,
      year: paper.year,
      name: paper.name,
      set: paper.set,
      draftCount: paper._count.questions,
      needsReview: needsReviewMap.get(paper.id) ?? 0,
    }))
  )
}

// Paper names promotePaper knows how to map onto a live exam type.
const PAPER_NAMES = ['GS1', 'CSAT']

// Creates an empty paper; questions are then added to it from the review page.
export async function POST(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const year = Number(body?.year)
  const name = String(body?.name ?? '').trim().toUpperCase()
  const set = String(body?.set ?? '').trim().toUpperCase() || null
  if (!Number.isInteger(year) || year < 1950 || year > 2100) {
    return NextResponse.json({ error: 'Enter a valid year' }, { status: 400 })
  }
  if (!PAPER_NAMES.includes(name)) {
    return NextResponse.json({ error: `Paper must be one of ${PAPER_NAMES.join(', ')}` }, { status: 400 })
  }

  // Live papers are keyed by exam + year only (QuestionPaper), so a second set
  // of the same year would overwrite the first one's live questions on promote.
  const sameYear = await prisma.paper.findFirst({ where: { year, name } })
  if (sameYear) {
    const label = `${year} ${name}${sameYear.set ? ` (Set ${sameYear.set})` : ''}`
    return NextResponse.json({ error: `${label} already exists — add questions to it instead` }, { status: 409 })
  }

  const paper = await prisma.paper.create({ data: { year, name, set } })
  return NextResponse.json(paper, { status: 201 })
}
