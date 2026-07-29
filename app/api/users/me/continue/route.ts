import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getContinueLearning } from '@/lib/continue-learning'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  return NextResponse.json(await getContinueLearning(user.id))
}
