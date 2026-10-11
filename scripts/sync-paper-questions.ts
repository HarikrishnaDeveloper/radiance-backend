import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { buildAllStages } from "../lib/stage-builder";

// Brings the database's past papers in line with prisma/seed-data/*.ts, in
// place: question number, category/subcategory, answer key, explanation and
// revision points are written onto the rows that already exist (draft and
// live), and seed questions missing from the live paper are added. Nothing is
// deleted or recreated, so users' attempts, stage progress and bookmarks
// survive — unlike promote-draft-questions.ts, which wipes a paper's live
// questions and fails once anyone has answered them.
//
// Live questions are matched to seed entries within the same paper by word
// overlap of question + option text, so re-transcribed wording (punctuation,
// spacing, small edits) still pairs up. A matched live row takes the seed's
// full content. Live rows with no match are deleted only when no user data
// points at them; otherwise they're kept and reported. Seed questions carrying
// `flagReview` are not added live until reviewed, matching the promotion
// rules. Stages are rebuilt afterwards because they group questions by category.
//
//   npx tsx scripts/sync-paper-questions.ts --dry-run   # report only
//   npx tsx scripts/sync-paper-questions.ts

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const dryRun = process.argv.includes("--dry-run");

type SeedQuestion = {
  no: number;
  text: string;
  A: string;
  B: string;
  C: string;
  D: string;
  ans: string | null;
  category: string;
  subcategory: string;
  expl?: string;
  revisionPoints?: string;
  flagReview?: string;
};
type SeedPaper = { paper: { year: number; name: string; set: string }; questions: SeedQuestion[] };

const LABELS = ["A", "B", "C", "D"] as const;
// Below this word-overlap score two questions are treated as different.
const MIN_SIMILARITY = 0.5;

function words(text: string) {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function similarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

const categoryIds = new Map<string, number>();
async function categoryId(name: string) {
  let id = categoryIds.get(name);
  if (id === undefined) {
    const existing = await prisma.category.findUnique({ where: { name } });
    id = existing?.id ?? (dryRun ? -1 : (await prisma.category.create({ data: { name } })).id);
    categoryIds.set(name, id);
  }
  return id;
}

const subcategoryIds = new Map<string, number>();
async function subcategoryId(name: string, catId: number) {
  const key = `${catId}::${name}`;
  let id = subcategoryIds.get(key);
  if (id === undefined) {
    id = dryRun
      ? -1
      : (
          await prisma.subcategory.upsert({
            where: { name_categoryId: { name, categoryId: catId } },
            update: {},
            create: { name, categoryId: catId },
          })
        ).id;
    subcategoryIds.set(key, id);
  }
  return id;
}

async function syncPaper({ paper: meta, questions }: SeedPaper) {
  const draftPaper = await prisma.paper.findFirst({ where: { year: meta.year, name: meta.name, set: meta.set } });
  const examType = await prisma.examType.findUnique({ where: { code: `PRELIMS_${meta.name}` } });
  const livePaper = examType
    ? await prisma.questionPaper.findUnique({ where: { examTypeId_year: { examTypeId: examType.id, year: meta.year } } })
    : null;

  const liveQuestions = livePaper
    ? await prisma.question.findMany({
        where: { questionPaperId: livePaper.id },
        include: { options: true, _count: { select: { answers: true, userProgress: true, dailyChallengeEntries: true } } },
      })
    : [];

  // Pair seed and live questions one-to-one, best overlap first.
  const seedWords = questions.map((q) => words([q.text, q.A, q.B, q.C, q.D].join(" ")));
  const liveWords = liveQuestions.map((q) => words([q.text, ...q.options.map((o) => o.text)].join(" ")));
  const pairs: { s: number; l: number; score: number }[] = [];
  seedWords.forEach((sw, s) =>
    liveWords.forEach((lw, l) => {
      const score = similarity(sw, lw);
      if (score >= MIN_SIMILARITY) pairs.push({ s, l, score });
    })
  );
  pairs.sort((a, b) => b.score - a.score);
  const liveForSeed = new Map<number, number>();
  const takenLive = new Set<number>();
  for (const p of pairs) {
    if (liveForSeed.has(p.s) || takenLive.has(p.l)) continue;
    liveForSeed.set(p.s, p.l);
    takenLive.add(p.l);
  }

  const tally = { matched: 0, keys: 0, added: 0, heldForReview: 0, removed: 0, keptOrphans: 0 };

  for (const [s, q] of questions.entries()) {
    const catId = await categoryId(q.category);
    const subId = await subcategoryId(q.subcategory, catId);
    const answer = q.ans && /^[ABCD]$/.test(q.ans) ? q.ans : null;
    const content = {
      questionNo: q.no,
      text: q.text,
      explanation: q.expl?.trim() || null,
      revisionPoints: q.revisionPoints?.trim() || null,
      categoryId: catId,
      isVoided: answer === null,
    };

    if (draftPaper && !dryRun) {
      await prisma.draftQuestion.updateMany({
        where: { paperId: draftPaper.id, questionNo: q.no },
        data: {
          categoryId: catId,
          subcategoryId: subId,
          correctAnswer: answer,
          explanation: content.explanation,
          revisionPoints: content.revisionPoints,
        },
      });
    }
    if (!livePaper) continue;

    const l = liveForSeed.get(s);
    if (l === undefined) {
      if (q.flagReview) {
        tally.heldForReview++;
        continue;
      }
      tally.added++;
      if (!dryRun) {
        await prisma.question.create({
          data: {
            ...content,
            questionPaperId: livePaper.id,
            options: { create: LABELS.map((label) => ({ label, text: q[label], isCorrect: answer === label })) },
          },
        });
      }
      continue;
    }

    const lq = liveQuestions[l];
    tally.matched++;
    if ((lq.options.find((o) => o.isCorrect)?.label ?? null) !== answer) tally.keys++;
    if (dryRun) continue;
    await prisma.question.update({ where: { id: lq.id }, data: content });
    for (const label of LABELS) {
      await prisma.option.upsert({
        where: { questionId_label: { questionId: lq.id, label } },
        update: { text: q[label], isCorrect: answer === label },
        create: { questionId: lq.id, label, text: q[label], isCorrect: answer === label },
      });
    }
  }

  // Live rows the seed no longer has. Stage membership is rebuilt below, so
  // only user-facing references (answers, progress, daily challenges) pin a row.
  for (const [l, lq] of liveQuestions.entries()) {
    if (takenLive.has(l)) continue;
    const referenced = lq._count.answers + lq._count.userProgress + lq._count.dailyChallengeEntries > 0;
    if (referenced) {
      tally.keptOrphans++;
      if (!dryRun) await prisma.question.update({ where: { id: lq.id }, data: { questionPaperId: null } });
      continue;
    }
    tally.removed++;
    if (!dryRun) {
      await prisma.stageQuestion.deleteMany({ where: { questionId: lq.id } });
      await prisma.option.deleteMany({ where: { questionId: lq.id } });
      await prisma.question.delete({ where: { id: lq.id } });
    }
  }

  console.log(
    `${meta.year} ${meta.name}: seed ${questions.length}, live ${liveQuestions.length} → matched ${tally.matched} ` +
      `(answer keys changed ${tally.keys}), added ${tally.added}, held for review ${tally.heldForReview}, ` +
      `removed ${tally.removed}, detached (user data) ${tally.keptOrphans}`
  );
}

async function main() {
  if (dryRun) console.log("DRY RUN — no changes will be written\n");
  const dir = path.join(__dirname, "..", "prisma", "seed-data");
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}\.ts$/.test(f)).sort();
  for (const file of files) {
    const data = (await import(pathToFileURL(path.join(dir, file)).href)) as SeedPaper;
    await syncPaper(data);
  }
  if (dryRun) return;

  const stages = await buildAllStages(prisma);
  for (const s of stages) console.log(`stages: ${s.categoryName} — ${s.totalQuestions} questions, ${s.totalStages} stages`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
