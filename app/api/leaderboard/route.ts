import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getLeaderboard } from '@/lib/leaderboard'

const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const requested = Number(request.nextUrl.searchParams.get('limit') ?? 50)
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : 50

  return NextResponse.json(await getLeaderboard(user.id, limit))
}
