import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { GOAL_LIMITS, getPlanGoals, getTaskHistory, parsePlanGoals, savePlanGoals } from '@/lib/study-plan'

// The student's recurring daily goals plus recent daily reports (today first).
async function planResponse(userId: string) {
  const [goals, history] = await Promise.all([getPlanGoals(userId), getTaskHistory(userId)])
  return { goals, limits: GOAL_LIMITS, today: history[0], history: history.slice(1) }
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  return NextResponse.json(await planResponse(user.id))
}

// Body: { goals: [{ type, target }] }. Replaces the plan; today's tasks are
// regenerated from it, earlier days' reports are left as they were.
export async function PUT(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const goals = parsePlanGoals(body?.goals)
  if (typeof goals === 'string') return NextResponse.json({ error: goals }, { status: 400 })

  await savePlanGoals(user.id, goals)
  return NextResponse.json(await planResponse(user.id))
}
