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
