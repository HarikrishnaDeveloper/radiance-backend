import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
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

const papers: SeedPaper[] = [data2013, data2014, data2015, data2016, data2017, data2018, data2019, data2020, data2021, data2022, data2023, data2024, data2025];

async function seedPaper({ paper: paperMeta, questions }: SeedPaper) {
  if (questions.length !== 100) {
    throw new Error(`${paperMeta.year}: expected 100 questions, got ${questions.length}`);
  }
  const nos = questions.map((q) => q.no);
  for (let i = 1; i <= 100; i++) {
    if (!nos.includes(i)) throw new Error(`${paperMeta.year}: missing questionNo ${i}`);
  }

  const { savedCount } = await prisma.$transaction(async (tx) => {
    let paper = await tx.paper.findFirst({
      where: { year: paperMeta.year, name: paperMeta.name, set: paperMeta.set },
    });
    if (!paper) {
      paper = await tx.paper.create({ data: paperMeta });
    }

    const importRecord = await tx.import.create({
      data: { paperId: paper.id, status: "SUCCESS" },
    });

    const categoryCache = new Map<string, { id: number }>();
    const subcategoryCache = new Map<string, { id: number }>();
    const tagCache = new Map<string, { id: number }>();
    let savedCount = 0;

    for (const q of questions) {
      let category = categoryCache.get(q.category);
      if (!category) {
        category = await tx.category.upsert({
          where: { name: q.category },
          update: {},
          create: { name: q.category },
        });
        categoryCache.set(q.category, category);
      }

      const subKey = `${q.category}::${q.subcategory}`;
      let subcategory = subcategoryCache.get(subKey);
      if (!subcategory) {
        subcategory = await tx.subcategory.upsert({
          where: { name_categoryId: { name: q.subcategory, categoryId: category.id } },
          update: {},
          create: { name: q.subcategory, categoryId: category.id },
        });
        subcategoryCache.set(subKey, subcategory);
      }

      const tagRecords = [];
      for (const tagName of q.tags || []) {
        let tag = tagCache.get(tagName);
        if (!tag) {
          tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          tagCache.set(tagName, tag);
        }
        tagRecords.push(tag);
      }

      // `dropped` is a resolved, final state (no valid answer exists — voided, not pending
      // review), so it doesn't block promotion the way `flagReview` does.
      const needsReview = !!q.flagReview;
      const reviewReason = q.flagReview;

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

      const question = await tx.draftQuestion.upsert({
        where: { paperId_questionNo: { paperId: paper.id, questionNo: q.no } },
        update: commonData,
        create: { questionNo: q.no, paperId: paper.id, ...commonData },
      });

      if (needsReview) {
        await tx.reviewQueue.upsert({
          where: { questionId: question.id },
          update: { reason: reviewReason!, resolved: false },
          create: { questionId: question.id, reason: reviewReason! },
        });
      }

      await tx.questionTag.deleteMany({ where: { questionId: question.id } });
      if (tagRecords.length > 0) {
        await tx.questionTag.createMany({
          data: tagRecords.map((t) => ({ questionId: question.id, tagId: t.id })),
        });
      }

      savedCount++;
    }

    await tx.importLog.create({
      data: {
        importId: importRecord.id,
        level: "INFO",
        message: `Seeded ${savedCount} questions for ${paperMeta.year} ${paperMeta.name} Set ${paperMeta.set}.`,
      },
    });

    return { savedCount };
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
