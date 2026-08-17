import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { promotePaper } from "../lib/promote-paper";

// Promotes reviewed questions from the draft/import pipeline (Paper -> DraftQuestion)
// into the live quiz-serving schema (ExamType -> QuestionPaper -> Question -> Option),
// for every paper. See lib/promote-paper.ts for the per-paper logic — also used by
// app/api/admin/papers/[id]/promote for promoting a single paper from the review UI.

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const papers = await prisma.paper.findMany({ orderBy: [{ year: "asc" }, { name: "asc" }] });
  for (const paper of papers) {
    const { promoted, total, skipped } = await promotePaper(prisma, paper);
    for (const questionNo of skipped) {
      console.warn(`  Skipping ${paper.year} ${paper.name} Q${questionNo}: incomplete data`);
    }
    const note = total !== promoted ? ` (${total - promoted} not yet approved / skipped)` : "";
    console.log(`${paper.year} ${paper.name}: promoted ${promoted}/${total}${note}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
