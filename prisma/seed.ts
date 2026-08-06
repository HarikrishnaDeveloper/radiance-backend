import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import * as data1995 from "./seed-data/1995";
import * as data1996 from "./seed-data/1996";
import * as data1997 from "./seed-data/1997";
import * as data1998 from "./seed-data/1998";
import * as data1999 from "./seed-data/1999";
import * as data2000 from "./seed-data/2000";
import * as data2001 from "./seed-data/2001";
import * as data2002 from "./seed-data/2002";
import * as data2003 from "./seed-data/2003";
import * as data2004 from "./seed-data/2004";
import * as data2005 from "./seed-data/2005";
import * as data2006 from "./seed-data/2006";
import * as data2007 from "./seed-data/2007";
import * as data2008 from "./seed-data/2008";
import * as data2009 from "./seed-data/2009";
import * as data2010 from "./seed-data/2010";
import * as data2011 from "./seed-data/2011";
import * as data2012 from "./seed-data/2012";
import * as data2013 from "./seed-data/2013";
import * as data2014 from "./seed-data/2014";
import * as data2015 from "./seed-data/2015";
import * as data2016 from "./seed-data/2016";
import * as data2017 from "./seed-data/2017";
import * as data2018 from "./seed-data/2018";
import * as data2019 from "./seed-data/2019";
import * as data2020 from "./seed-data/2020";
import * as data2021 from "./seed-data/2021";
import * as data2022 from "./seed-data/2022";
import * as data2023 from "./seed-data/2023";
import * as data2024 from "./seed-data/2024";
import * as data2025 from "./seed-data/2025";

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
  tags?: string[];
  expl?: string;
  dropped?: boolean;
  flagReview?: string;
};

type SeedPaper = {
  paper: { year: number; name: string; set: string };
  questions: SeedQuestion[];
};

const BATCH_SIZE = 100;

const papers: SeedPaper[] = [data1995, data1996, data1997, data1998, data1999, data2000, data2001, data2002, data2003, data2004, data2005, data2006, data2007, data2008, data2009, data2010, data2011, data2012, data2013, data2014, data2015, data2016, data2017, data2018, data2019, data2020, data2021, data2022, data2023, data2024, data2025];

async function seedPaper({ paper: paperMeta, questions }: SeedPaper) {
  if (questions.length === 0) {
    throw new Error(`${paperMeta.year}: no questions provided`);
  }
  const nos = questions.map((q) => q.no);
  const duplicates = nos.filter((n, i) => nos.indexOf(n) !== i);
  if (duplicates.length > 0) {
    throw new Error(`${paperMeta.year}: duplicate questionNo(s) ${[...new Set(duplicates)].join(", ")}`);
  }

  let paper = await prisma.paper.findFirst({
    where: { year: paperMeta.year, name: paperMeta.name, set: paperMeta.set },
  });
  if (!paper) {
    paper = await prisma.paper.create({ data: paperMeta });
  }

  const importRecord = await prisma.import.create({
    data: { paperId: paper.id, status: "SUCCESS" },
  });

  const categoryCache = new Map<string, { id: number }>();
  const subcategoryCache = new Map<string, { id: number }>();
  const tagCache = new Map<string, { id: number }>();

  type QuestionMeta = { tagIds: number[]; needsReview: boolean; reviewReason?: string };
  const ops: ReturnType<typeof prisma.draftQuestion.upsert>[] = [];
  const metas: QuestionMeta[] = [];

  // Category/subcategory/tag lookups are cached, so this pass is cheap even though it's
  // sequential — the paper only has a handful of distinct categories/subcategories/tags.
  for (const q of questions) {
    let category = categoryCache.get(q.category);
    if (!category) {
      category = await prisma.category.upsert({
        where: { name: q.category },
        update: {},
        create: { name: q.category },
      });
      categoryCache.set(q.category, category);
    }

    const subKey = `${q.category}::${q.subcategory}`;
    let subcategory = subcategoryCache.get(subKey);
    if (!subcategory) {
      subcategory = await prisma.subcategory.upsert({
        where: { name_categoryId: { name: q.subcategory, categoryId: category.id } },
        update: {},
        create: { name: q.subcategory, categoryId: category.id },
      });
      subcategoryCache.set(subKey, subcategory);
    }

    const tagIds: number[] = [];
    for (const tagName of q.tags || []) {
      let tag = tagCache.get(tagName);
      if (!tag) {
        tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        tagCache.set(tagName, tag);
      }
      tagIds.push(tag.id);
    }

    // `dropped` is a resolved, final state (no valid answer exists — voided, not pending
    // review), so it doesn't block promotion the way `flagReview` does.
    const needsReview = !!q.flagReview;

    const commonData = {
      text: q.text,
      optionA: q.A,
      optionB: q.B,
      optionC: q.C,
      optionD: q.D,
      correctAnswer: q.ans,
      explanation: q.expl || (q.dropped ? "Question was officially dropped by UPSC; full marks were awarded to all candidates. No valid answer key entry exists." : ""),
      explanationSource: "",
      parseConfidence: 1.0,
      categoryConfidence: 1.0,
      answerConfidence: q.dropped ? 0.0 : (needsReview ? 0.5 : 1.0),
      status: needsReview ? "NEEDS_REVIEW" : "APPROVED",
      categoryId: category.id,
      subcategoryId: subcategory.id,
    };

    ops.push(
      prisma.draftQuestion.upsert({
        where: { paperId_questionNo: { paperId: paper.id, questionNo: q.no } },
        update: commonData,
        create: { questionNo: q.no, paperId: paper.id, ...commonData },
      })
    );
    metas.push({ tagIds, needsReview, reviewReason: q.flagReview });
  }

  // Batch the actual writes (100 questions per transaction) instead of one interactive
  // transaction for the whole paper — that held a single Neon connection open for minutes
  // and blew past the interactive transaction timeout.
  let savedCount = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const opBatch = ops.slice(i, i + BATCH_SIZE);
    const metaBatch = metas.slice(i, i + BATCH_SIZE);

    const savedQuestions = await prisma.$transaction(opBatch, { timeout: 120_000 });

    const followUps: Prisma.PrismaPromise<unknown>[] = [];
    savedQuestions.forEach((question, idx) => {
      const meta = metaBatch[idx];
      followUps.push(prisma.questionTag.deleteMany({ where: { questionId: question.id } }));
      if (meta.tagIds.length > 0) {
        followUps.push(
          prisma.questionTag.createMany({
            data: meta.tagIds.map((tagId) => ({ questionId: question.id, tagId })),
          })
        );
      }
      if (meta.needsReview) {
        followUps.push(
          prisma.reviewQueue.upsert({
            where: { questionId: question.id },
            update: { reason: meta.reviewReason!, resolved: false },
            create: { questionId: question.id, reason: meta.reviewReason! },
          })
        );
      }
    });

    if (followUps.length > 0) {
      await prisma.$transaction(followUps, { timeout: 120_000 });
    }

    savedCount += opBatch.length;
  }

  await prisma.importLog.create({
    data: {
      importId: importRecord.id,
      level: "INFO",
      message: `Seeded ${savedCount} questions for ${paperMeta.year} ${paperMeta.name} Set ${paperMeta.set}.`,
    },
  });

  console.log(`${paperMeta.year}: seeded ${savedCount} questions`);
}

async function main() {
  for (const p of papers) {
    await seedPaper(p);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
