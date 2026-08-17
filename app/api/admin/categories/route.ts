import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const categories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { questions: true, stages: true } } },
  })

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      foodWorldName: c.foodWorldName,
      icon: c.icon,
      color: c.color,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      questionCount: c._count.questions,
      stageCount: c._count.stages,
    }))
  )
}
