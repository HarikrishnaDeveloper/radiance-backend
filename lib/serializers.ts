import type { User, UserProfile } from '@prisma/client'

// Shape of a User handed back to the client on auth responses. Excludes
// passwordHash and other internal fields; every auth route should build its
// response through this rather than hand-picking fields itself.
export function publicUser(user: User & { profile?: UserProfile | null }) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    email: user.email,
    state: user.state,
    profileCompleted: user.profileCompleted ?? false,
    profile: user.profile
      ? {
          fullName: user.profile.fullName,
          targetExam: user.profile.targetExam,
          preparationLevel: user.profile.preparationLevel,
          targetAttempt: user.profile.targetAttempt,
          preparationFocus: user.profile.preparationFocus,
        }
      : null,
    isTestUser: user.isTestUser,
    isPremium: user.isPremium,
  }
}

// Prisma `select` shape for questions shown to a client mid-attempt.
// Deliberately omits `Option.isCorrect` and `Question.explanation` — both
// would hand over the answer key before the attempt is complete.
export const safeQuestionSelect = {
  id: true,
  questionNo: true,
  text: true,
  questionImage: true,
  categoryId: true,
  difficulty: true,
  category: { select: { id: true, name: true } },
  questionPaper: { select: { year: true } },
  options: {
    select: { id: true, label: true, text: true },
    orderBy: { label: 'asc' as const },
  },
} as const
