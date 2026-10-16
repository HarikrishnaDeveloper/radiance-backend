import type { StudyGoalType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ==========================================================================
// Study plan: the student's recurring daily goals (StudyPlanGoal) and the
// per-day task snapshots generated from them (DailyTask). A day's tasks are
// created the first time that day is read; progress is never stored — it's
// counted from the activity rows themselves, so it can't drift from what the
// student actually did.
// ==========================================================================

export const GOAL_TYPES: StudyGoalType[] = ['STAGES', 'QUESTIONS', 'DAILY_CHALLENGE', 'FULL_TEST']

// Allowed target range per goal. The daily challenge exists once a day, so
// its only valid target is 1.
export const GOAL_LIMITS: Record<StudyGoalType, { min: number; max: number }> = {
  STAGES: { min: 1, max: 10 },
  QUESTIONS: { min: 10, max: 300 },
  DAILY_CHALLENGE: { min: 1, max: 1 },
  FULL_TEST: { min: 1, max: 3 },
}

// What a student gets before they've configured anything. A saved plan always
// has at least one goal (the PUT route enforces it), so "no goals" means
// "never configured".
const DEFAULT_PLAN: { type: StudyGoalType; target: number }[] = [
  { type: 'STAGES', target: 2 },
  { type: 'DAILY_CHALLENGE', target: 1 },
]

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export type StudyTask = { type: StudyGoalType; target: number; progress: number; status: TaskStatus }

export type StudyDay = { date: string; tasks: StudyTask[]; completed: number; total: number }

export type PlanGoal = { type: StudyGoalType; target: number }

const DAY_MS = 24 * 60 * 60 * 1000

// UTC midnight of the given instant — the same day bucketing lib/streak.ts uses.
export function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function getPlanGoals(userId: string): Promise<PlanGoal[]> {
  const goals = await prisma.studyPlanGoal.findMany({ where: { userId }, select: { type: true, target: true } })
  if (goals.length > 0) return sortGoals(goals)

  await prisma.studyPlanGoal.createMany({
    data: DEFAULT_PLAN.map((g) => ({ userId, ...g })),
    skipDuplicates: true,
  })
  return [...DEFAULT_PLAN]
}

function sortGoals<T extends { type: StudyGoalType }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => GOAL_TYPES.indexOf(a.type) - GOAL_TYPES.indexOf(b.type))
}

// Replaces the plan and regenerates today's tasks from it. Past days keep the
// targets they were generated with.
export async function savePlanGoals(userId: string, goals: PlanGoal[]) {
  const today = utcDay()
  await prisma.$transaction([
    prisma.studyPlanGoal.deleteMany({ where: { userId } }),
    prisma.studyPlanGoal.createMany({ data: goals.map((g) => ({ userId, ...g })) }),
    prisma.dailyTask.deleteMany({ where: { userId, date: today } }),
    prisma.dailyTask.createMany({ data: goals.map((g) => ({ userId, date: today, ...g })) }),
  ])
}

// Validates a client-submitted plan: known types, no duplicates, targets in range.
export function parsePlanGoals(input: unknown): PlanGoal[] | string {
  if (!Array.isArray(input) || input.length === 0) return 'Choose at least one daily goal.'
  const seen = new Set<StudyGoalType>()
  const goals: PlanGoal[] = []
  for (const raw of input) {
    const type = (raw as { type?: unknown })?.type
    const target = (raw as { target?: unknown })?.target
    if (typeof type !== 'string' || !GOAL_TYPES.includes(type as StudyGoalType)) return 'Unknown goal type.'
    const goalType = type as StudyGoalType
    if (seen.has(goalType)) return 'Each goal can only appear once.'
    const { min, max } = GOAL_LIMITS[goalType]
    if (typeof target !== 'number' || !Number.isInteger(target) || target < min || target > max) {
      return `Target for ${goalType} must be between ${min} and ${max}.`
    }
    seen.add(goalType)
    goals.push({ type: goalType, target })
  }
  return sortGoals(goals)
}

// How much of each goal type the user did on each UTC day in [from, to).
async function activityByDay(userId: string, from: Date, to: Date) {
  const range = { gte: from, lt: to }
  const [stages, stageAnswers, attemptAnswers, challenges, tests] = await Promise.all([
    prisma.userStageProgress.findMany({
      where: { userId, status: 'COMPLETED', completedAt: range },
      select: { completedAt: true },
    }),
    prisma.userQuestionProgress.findMany({
      where: { userId, selectedOption: { not: null }, attemptedAt: range },
      select: { attemptedAt: true },
    }),
    prisma.attemptAnswer.findMany({
      where: { attempt: { userId }, selectedOptionId: { not: null }, answeredAt: range },
      select: { answeredAt: true },
    }),
    prisma.userDailyChallengeProgress.findMany({
      where: { userId, completedAt: range },
      select: { completedAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, ...FULL_TEST_WHERE, completedAt: range },
      select: { completedAt: true },
    }),
  ])

  const counts = new Map<string, Record<StudyGoalType, number>>()
  const bump = (d: Date | null, type: StudyGoalType) => {
    if (!d) return
    const key = dayKey(d)
    const row = counts.get(key) ?? { STAGES: 0, QUESTIONS: 0, DAILY_CHALLENGE: 0, FULL_TEST: 0 }
    row[type]++
    counts.set(key, row)
  }
  stages.forEach((r) => bump(r.completedAt, 'STAGES'))
  stageAnswers.forEach((r) => bump(r.attemptedAt, 'QUESTIONS'))
  attemptAnswers.forEach((r) => bump(r.answeredAt, 'QUESTIONS'))
  challenges.forEach((r) => bump(r.completedAt, 'DAILY_CHALLENGE'))
  tests.forEach((r) => bump(r.completedAt, 'FULL_TEST'))
  return counts
}

// Completed whole-paper tests — the same rule for task progress, the
// "tests attempted" stat and the leaderboard's pool of attempts.
export const FULL_TEST_WHERE = {
  mode: 'FULL_PAPER' as const,
  sectionCategoryId: null,
  completedAt: { not: null },
}

function toTask(type: StudyGoalType, target: number, done: number): StudyTask {
  const progress = Math.min(done, target)
  const status: TaskStatus = progress >= target ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'PENDING'
  return { type, target, progress, status }
}

function toStudyDays(
  tasks: { date: Date; type: StudyGoalType; target: number }[],
  activity: Map<string, Record<StudyGoalType, number>>,
): StudyDay[] {
  const byDay = new Map<string, StudyTask[]>()
  for (const t of sortGoals(tasks)) {
    const key = dayKey(t.date)
    const list = byDay.get(key) ?? []
    list.push(toTask(t.type, t.target, activity.get(key)?.[t.type] ?? 0))
    byDay.set(key, list)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      tasks: list,
      completed: list.filter((t) => t.status === 'COMPLETED').length,
      total: list.length,
    }))
}

// Today's tasks (generated from the plan on first read) with live progress.
export async function getTodayTasks(userId: string): Promise<StudyDay> {
  const today = utcDay()
  let tasks = await prisma.dailyTask.findMany({ where: { userId, date: today } })
  if (tasks.length === 0) {
    const goals = await getPlanGoals(userId)
    await prisma.dailyTask.createMany({
      data: goals.map((g) => ({ userId, date: today, ...g })),
      skipDuplicates: true,
    })
    tasks = await prisma.dailyTask.findMany({ where: { userId, date: today } })
  }

  const activity = await activityByDay(userId, today, new Date(today.getTime() + DAY_MS))
  return toStudyDays(tasks, activity)[0] ?? { date: dayKey(today), tasks: [], completed: 0, total: 0 }
}

// Daily reports for the last `days` days (today first). Only days the student
// had tasks for appear — a day they never opened the app has no snapshot.
export async function getTaskHistory(userId: string, days = 14): Promise<StudyDay[]> {
  await getTodayTasks(userId)
  const to = new Date(utcDay().getTime() + DAY_MS)
  const from = new Date(to.getTime() - days * DAY_MS)
  const [tasks, activity] = await Promise.all([
    prisma.dailyTask.findMany({ where: { userId, date: { gte: from, lt: to } } }),
    activityByDay(userId, from, to),
  ])
  return toStudyDays(tasks, activity)
}
