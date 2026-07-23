import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { questions: true } } },
  })

  return NextResponse.json(
    categories.map((c) => ({ id: c.id, name: c.name, questionCount: c._count.questions }))
  )
}
