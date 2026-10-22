import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const paperId = Number(id)
  if (!Number.isInteger(paperId)) {
    return NextResponse.json({ error: 'Invalid paper id' }, { status: 400 })
  }

  const paper = await prisma.paper.findUnique({ where: { id: paperId } })
  if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

  const [drafts, categories, liveCount] = await Promise.all([
    prisma.draftQuestion.findMany({ where: { paperId }, orderBy: { questionNo: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.question.count({
      where: {
        questionPaper: {
          examType: { code: `PRELIMS_${paper.name}` },
          year: paper.year,
        },
      },
    }),
  ])

  return NextResponse.json({ paper, drafts, categories, liveCount })
}

// Adds a blank draft question at the end of the paper (next questionNo), to be
// filled in and approved from the review page like any imported question.
export async function POST(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const paperId = Number(id)
  if (!Number.isInteger(paperId)) {
    return NextResponse.json({ error: 'Invalid paper id' }, { status: 400 })
  }

  const paper = await prisma.paper.findUnique({ where: { id: paperId } })
  if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

  const last = await prisma.draftQuestion.aggregate({ where: { paperId }, _max: { questionNo: true } })
  const draft = await prisma.draftQuestion.create({
    data: { paperId, questionNo: (last._max.questionNo ?? 0) + 1, text: '', status: 'NEEDS_REVIEW' },
  })
  return NextResponse.json(draft, { status: 201 })
}
