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
// questions are updated in place from its current draft state (see below).
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

  // Live questions are updated in place, matched by questionNo, never wiped
  // and recreated: stages, attempts, daily challenges and user progress all
  // point at question/option ids, so those ids must survive a re-promote.
  const existing = await prisma.question.findMany({
    where: { questionPaperId: questionPaper.id },
    select: { id: true, questionNo: true },
    orderBy: { id: 'asc' },
  })
  const liveByNo = new Map<number, number>()
  for (const q of existing) {
    if (q.questionNo !== null && !liveByNo.has(q.questionNo)) liveByNo.set(q.questionNo, q.id)
  }

  const draftQuestions = await prisma.draftQuestion.findMany({
    where: { paperId: paper.id, status: 'APPROVED' },
    orderBy: { questionNo: 'asc' },
  })

  let promoted = 0
  const skipped: number[] = []
  const kept = new Set<number>()
  for (const dq of draftQuestions) {
    // An option may be text, a picture, or both — it just can't be neither.
    const options = (['A', 'B', 'C', 'D'] as const).map((label) => ({
      label,
      text: dq[`option${label}`] ?? '',
      imageUrl: dq[`option${label}Image`] || null,
      isCorrect: dq.correctAnswer === label,
    }))
    if (!dq.text.trim() || options.some((o) => !o.text && !o.imageUrl) || !dq.categoryId) {
      skipped.push(dq.questionNo)
      continue
    }

    const data = {
      questionNo: dq.questionNo,
      text: dq.text,
      explanation: dq.explanation || null,
      revisionPoints: dq.revisionPoints || null,
      categoryId: dq.categoryId,
      questionPaperId: questionPaper.id,
      isVoided: !dq.correctAnswer,
      questionImage: dq.questionImage,
    }

    const liveId = liveByNo.get(dq.questionNo)
    if (liveId === undefined) {
      await prisma.question.create({ data: { ...data, options: { create: options } } })
    } else {
      kept.add(liveId)
      await prisma.$transaction([
        prisma.question.update({ where: { id: liveId }, data }),
        ...options.map(({ label, ...option }) =>
          prisma.option.upsert({
            where: { questionId_label: { questionId: liveId, label } },
            update: option,
            create: { ...option, label, questionId: liveId },
          })
        ),
      ])
    }
    promoted++
  }

  // Live questions with no approved draft any more come off the paper. One
  // already used by a stage, attempt, challenge or user progress can't be
  // deleted without destroying that history, so it stays and is reported.
  const retained: number[] = []
  for (const q of existing) {
    if (kept.has(q.id)) continue
    try {
      // One transaction: if the question can't go, its options must stay too.
      await prisma.$transaction([
        prisma.option.deleteMany({ where: { questionId: q.id } }),
        prisma.question.delete({ where: { id: q.id } }),
      ])
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2003') throw e
      retained.push(q.questionNo ?? q.id)
    }
  }

  const total = await prisma.draftQuestion.count({ where: { paperId: paper.id } })
  return { promoted, total, skipped, retained }
}
