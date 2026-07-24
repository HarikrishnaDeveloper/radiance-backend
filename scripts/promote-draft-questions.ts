import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Promotes reviewed questions from the draft/import pipeline (Paper -> DraftQuestion)
// into the live quiz-serving schema (ExamType -> QuestionPaper -> Question -> Option).
// Only DraftQuestions with status "APPROVED" are promoted; anything still under
// review (see ReviewQueue) is left out until it's resolved. Questions with no
// correctAnswer (voided — see DraftQuestion.explanation for why) are still promoted
// so paper question counts stay accurate; they're scored as correct for everyone.
// Safe to re-run: each paper's live questions are wiped and rebuilt from its
// current draft state.

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const EXAM_TYPE_NAMES: Record<string, string> = {
  GS1: "Prelims General Studies I",
  CSAT: "Prelims General Studies II (CSAT)",
};

async function promotePaper(paper: { id: number; year: number; name: string; set: string | null }) {
  const examCode = `PRELIMS_${paper.name}`;
  const examTypeName = EXAM_TYPE_NAMES[paper.name] ?? `Prelims ${paper.name}`;

  const examType = await prisma.examType.upsert({
    where: { code: examCode },
    update: {},
    create: { code: examCode, name: examTypeName },
  });

  const questionPaper = await prisma.questionPaper.upsert({
    where: { examTypeId_year: { examTypeId: examType.id, year: paper.year } },
    update: {},
    create: {
      year: paper.year,
      examTypeId: examType.id,
      title: `UPSC CSE Prelims ${paper.year} - ${examTypeName}`,
    },
  });

  // Wipe this paper's live questions so re-running the script reflects the current draft state.
  const existing = await prisma.question.findMany({
    where: { questionPaperId: questionPaper.id },
    select: { id: true },
  });
  const existingIds = existing.map((q) => q.id);
  await prisma.option.deleteMany({ where: { questionId: { in: existingIds } } });
  await prisma.question.deleteMany({ where: { id: { in: existingIds } } });

  const draftQuestions = await prisma.draftQuestion.findMany({
    where: { paperId: paper.id, status: "APPROVED" },
    orderBy: { questionNo: "asc" },
  });

  let promoted = 0;
  for (const dq of draftQuestions) {
    if (!dq.optionA || !dq.optionB || !dq.optionC || !dq.optionD || !dq.categoryId) {
      console.warn(`  Skipping ${paper.year} ${paper.name} Q${dq.questionNo}: incomplete data`);
      continue;
    }

    // No correctAnswer means this question is voided (e.g. officially dropped by UPSC, or a
    // source defect with no valid option) — still included so the paper has its full question
    // count, but scored as correct for everyone regardless of selection (see answers/route.ts).
    const isVoided = !dq.correctAnswer;

    await prisma.question.create({
      data: {
        text: dq.text,
        explanation: dq.explanation || null,
        categoryId: dq.categoryId,
        questionPaperId: questionPaper.id,
        isVoided,
        options: {
          create: [
            { label: "A", text: dq.optionA, isCorrect: dq.correctAnswer === "A" },
            { label: "B", text: dq.optionB, isCorrect: dq.correctAnswer === "B" },
            { label: "C", text: dq.optionC, isCorrect: dq.correctAnswer === "C" },
            { label: "D", text: dq.optionD, isCorrect: dq.correctAnswer === "D" },
          ],
        },
      },
    });
    promoted++;
  }

  const total = await prisma.draftQuestion.count({ where: { paperId: paper.id } });
  const note = total !== promoted ? ` (${total - promoted} not yet approved / skipped)` : "";
  console.log(`${paper.year} ${paper.name}: promoted ${promoted}/${total}${note}`);
}

async function main() {
  const papers = await prisma.paper.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] });
  for (const paper of papers) {
    await promotePaper(paper);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
