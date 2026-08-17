import type { PrismaClient } from '@prisma/client'

const EXAM_TYPE_NAMES: Record<string, string> = {
  GS1: 'Prelims General Studies I',
  CSAT: 'Prelims General Studies II (CSAT)',
}

// Promotes reviewed questions from the draft/import pipeline (Paper -> DraftQuestion)
// into the live quiz-serving schema (ExamType -> QuestionPaper -> Question -> Option).
// Only DraftQuestions with status "APPROVED" are promoted; anything still under
// review (see ReviewQueue) is left out until it's resolved. Questions with no
// correctAnswer (voided) are still promoted so paper question counts stay accurate;
// they're scored as correct for everyone. Safe to re-run: this paper's live
// questions are wiped and rebuilt from its current draft state.
//
// Shared by scripts/promote-draft-questions.ts (promotes every paper) and
// app/api/admin/papers/[id]/promote (promotes one, from the review UI).
// Takes the caller's own PrismaClient rather than importing the shared
// singleton from lib/prisma.ts — the script constructs its client only after
// manually loading .env (see its own file), and importing lib/prisma at the
// top of this module would evaluate (and read process.env.DATABASE_URL) before
// that loader runs, since imports are hoisted above the script's body.
export async function promotePaper(
  prisma: PrismaClient,
  paper: { id: number; year: number; name: string; set: string | null }
) {
  const examCode = `PRELIMS_${paper.name}`
  const examTypeName = EXAM_TYPE_NAMES[paper.name] ?? `Prelims ${paper.name}`

  const examType = await prisma.examType.upsert({
    where: { code: examCode },
    update: {},
    create: { code: examCode, name: examTypeName },
  })

  const questionPaper = await prisma.questionPaper.upsert({
    where: { examTypeId_year: { examTypeId: examType.id, year: paper.year } },
    update: {},
    create: {
      year: paper.year,
      examTypeId: examType.id,
      title: `UPSC CSE Prelims ${paper.year} - ${examTypeName}`,
    },
  })

  const existing = await prisma.question.findMany({
    where: { questionPaperId: questionPaper.id },
    select: { id: true },
  })
  const existingIds = existing.map((q) => q.id)
  await prisma.option.deleteMany({ where: { questionId: { in: existingIds } } })
  await prisma.question.deleteMany({ where: { id: { in: existingIds } } })

  const draftQuestions = await prisma.draftQuestion.findMany({
    where: { paperId: paper.id, status: 'APPROVED' },
    orderBy: { questionNo: 'asc' },
  })

  let promoted = 0
  const skipped: number[] = []
  for (const dq of draftQuestions) {
    if (!dq.optionA || !dq.optionB || !dq.optionC || !dq.optionD || !dq.categoryId) {
      skipped.push(dq.questionNo)
      continue
    }

    const isVoided = !dq.correctAnswer
    await prisma.question.create({
      data: {
        text: dq.text,
        explanation: dq.explanation || null,
        categoryId: dq.categoryId,
        questionPaperId: questionPaper.id,
        isVoided,
        questionImage: dq.questionImage,
        options: {
          create: [
            { label: 'A', text: dq.optionA, isCorrect: dq.correctAnswer === 'A' },
            { label: 'B', text: dq.optionB, isCorrect: dq.correctAnswer === 'B' },
            { label: 'C', text: dq.optionC, isCorrect: dq.correctAnswer === 'C' },
            { label: 'D', text: dq.optionD, isCorrect: dq.correctAnswer === 'D' },
          ],
        },
      },
    })
    promoted++
  }

  const total = await prisma.draftQuestion.count({ where: { paperId: paper.id } })
  return { promoted, total, skipped }
}
