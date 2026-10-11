import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { paper as paperMeta, questions } from './seed-data/2026'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type Letter = 'A' | 'B' | 'C' | 'D'

function formatOptions(a: string, b: string, c: string, d: string, correct: string) {
  const raw: Record<Letter, string> = { A: a, B: b, C: c, D: d }
  return (['A', 'B', 'C', 'D'] as Letter[]).map((label) => ({
    label,
    text: raw[label],
    isCorrect: label === correct.toUpperCase(),
  }))
}

async function main() {
  console.log(`Seeding UPSC Prelims GS1 ${paperMeta.year} paper...`)

  const examType = await prisma.examType.upsert({
    where: { code: 'PRELIMS_GS1' },
    update: {},
    create: { code: 'PRELIMS_GS1', name: 'Prelims General Studies I' },
  })

  const paper = await prisma.questionPaper.upsert({
    where: { examTypeId_year: { examTypeId: examType.id, year: paperMeta.year } },
    update: {},
    create: {
      year: paperMeta.year,
      examTypeId: examType.id,
      title: `UPSC CSE Prelims ${paperMeta.year} - General Studies I`,
    },
  })

  // Clear existing questions for this paper if re-seeding
  const existing = await prisma.question.findMany({
    where: { questionPaperId: paper.id },
    select: { id: true },
  })
  const existingIds = existing.map((q) => q.id)
  if (existingIds.length > 0) {
    await prisma.option.deleteMany({ where: { questionId: { in: existingIds } } })
    await prisma.question.deleteMany({ where: { id: { in: existingIds } } })
  }

  const categoryCache = new Map<string, number>()
  async function categoryId(name: string): Promise<number> {
    if (categoryCache.has(name)) return categoryCache.get(name)!
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    categoryCache.set(name, category.id)
    return category.id
  }

  let count = 0
  for (const q of questions) {
    const catId = await categoryId(q.category || 'Miscellaneous')
    const opts = formatOptions(q.A, q.B, q.C, q.D, q.ans)

    await prisma.question.create({
      data: {
        questionNo: q.no,
        text: q.text,
        explanation: q.expl || null,
        revisionPoints: q.revisionPoints || null,
        categoryId: catId,
        questionPaperId: paper.id,
        options: {
          create: opts,
        },
      },
    })
    count++
  }

  console.log(`Successfully seeded ${count} questions for UPSC Prelims GS1 ${paperMeta.year} with full choices, answer, explanation, and UPSC review points.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
