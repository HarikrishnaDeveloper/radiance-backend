import { execSync } from 'node:child_process'

execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
execSync('npx tsx scripts/promote-draft-questions.ts', { stdio: 'inherit' })
execSync('npx tsx prisma/seed-2026-prelims-gs1.ts', { stdio: 'inherit' })
execSync('npx tsx scripts/build-stages.ts', { stdio: 'inherit' })
execSync('npx tsx prisma/seed-demo-user.ts', { stdio: 'inherit' })
