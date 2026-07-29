import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { buildAllStages, buildStagesForCategory } from "../lib/stage-builder";

// Groups each category's questions into fixed batches of 10 (Stage 1, Stage 2, ...).
// Safe to re-run: every stage's question mapping is rebuilt from the current
// question set. Pass a category id to rebuild only that category (e.g. after
// importing new questions for it); omit it to rebuild every category.
//
//   npm run stages:build            # rebuild all categories
//   npm run stages:build -- 3       # rebuild only category id 3

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const categoryIdArg = process.argv[2];

  if (categoryIdArg) {
    const categoryId = Number(categoryIdArg);
    if (!Number.isInteger(categoryId)) {
      throw new Error(`Invalid category id: ${categoryIdArg}`);
    }
    const result = await buildStagesForCategory(prisma, categoryId);
    console.log(`${result.categoryName}: ${result.totalQuestions} questions -> ${result.totalStages} stages`);
    return;
  }

  const results = await buildAllStages(prisma);
  for (const result of results) {
    console.log(`${result.categoryName}: ${result.totalQuestions} questions -> ${result.totalStages} stages`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
