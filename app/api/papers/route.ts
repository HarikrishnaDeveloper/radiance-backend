import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const papers = await prisma.questionPaper.findMany({
    orderBy: { year: 'desc' },
    include: { examType: true, _count: { select: { questions: true } } },
  })

  return NextResponse.json(
    papers.map((p) => ({
      id: p.id,
      year: p.year,
      title: p.title,
      examType: { code: p.examType.code, name: p.examType.name },
      questionCount: p._count.questions,
    }))
  )
}
