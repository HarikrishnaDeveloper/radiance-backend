import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../lib/password'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const EXAM_TYPES = [
  { code: 'PRELIMS_GS1', name: 'Prelims General Studies I' },
]

const CATEGORIES = [
  'History',
  'Polity & Governance',
  'Geography',
  'Economy',
  'Science & Technology',
  'Environment & Ecology',
  'Art & Culture',
  'International Relations',
  'Current Affairs',
  'Miscellaneous',
]

async function main() {
  console.log('Seeding exam types...')
  for (const examType of EXAM_TYPES) {
    await prisma.examType.upsert({
      where: { code: examType.code },
      update: {},
      create: examType,
    })
  }

  console.log('Seeding categories...')
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log('Seeding demo user...')
  await prisma.user.upsert({
    where: { username: 'Radiance' },
    update: {},
    create: {
      username: 'Radiance',
      email: 'radiance@example.com',
      name: 'Radiance',
      passwordHash: await hashPassword('Elakki123'),
    },
  })

  console.log('Base seeding finished.')
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
