import type { StudyDay } from '@/lib/study-plan'

// Home-screen reminders and study updates. Derived from the user's current
// state on every dashboard read rather than stored, so each one disappears
// as soon as the thing it asks for is done — no read/unread bookkeeping.
export type AppNotification = {
  id: string
  kind: 'reminder' | 'update'
  title: string
  body: string
  route: string
}

export function buildNotifications(input: {
  streak: number
  answeredToday: boolean
  dailyChallengeCompleted: boolean
  today: StudyDay
  unfinishedTest: { id: number; title: string } | null
}): AppNotification[] {
  const { streak, answeredToday, dailyChallengeCompleted, today, unfinishedTest } = input
  const list: AppNotification[] = []

  if (streak > 0 && !answeredToday) {
    list.push({
      id: 'streak-at-risk',
      kind: 'reminder',
      title: `Keep your ${streak}-day streak alive`,
      body: 'Complete one practice activity today so your streak doesn’t reset.',
      route: '/practice',
    })
  }

  if (unfinishedTest) {
    list.push({
      id: `unfinished-test-${unfinishedTest.id}`,
      kind: 'reminder',
      title: 'You have an unfinished test',
      body: `Pick up ${unfinishedTest.title} where you left off.`,
      route: `/test/${unfinishedTest.id}`,
    })
  }

  const pending = today.total - today.completed
  if (today.total > 0 && pending > 0) {
    list.push({
      id: 'tasks-pending',
      kind: 'reminder',
      title: `${pending} of ${today.total} study tasks left today`,
      body: 'Finish today’s plan to hit your daily goal.',
      route: '/daily-tasks',
    })
  } else if (today.total > 0) {
    list.push({
      id: 'goal-complete',
      kind: 'update',
      title: 'Daily goal complete',
      body: `All ${today.total} tasks done for today. See you tomorrow!`,
      route: '/daily-tasks',
    })
  }

  if (!dailyChallengeCompleted) {
    list.push({
      id: 'daily-challenge',
      kind: 'update',
      title: 'Today’s Daily Challenge is ready',
      body: '10 mixed PYQs from across the syllabus.',
      route: '/daily-challenge',
    })
  }

  return list
}
