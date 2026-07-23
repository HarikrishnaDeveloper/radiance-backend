// Prisma `select` shape for questions shown to a client mid-attempt.
// Deliberately omits `Option.isCorrect` and `Question.explanation` — both
// would hand over the answer key before the attempt is complete.
export const safeQuestionSelect = {
  id: true,
  text: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  options: {
    select: { id: true, label: true, text: true },
    orderBy: { label: 'asc' as const },
  },
} as const
