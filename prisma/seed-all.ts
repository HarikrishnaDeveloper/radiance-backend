import { execSync } from 'node:child_process'

execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
// New papers are promoted; papers already live are updated in place.
execSync('npx tsx scripts/promote-draft-questions.ts', { stdio: 'inherit' })
execSync('npx tsx scripts/sync-paper-questions.ts', { stdio: 'inherit' })
execSync('npx tsx scripts/build-stages.ts', { stdio: 'inherit' })
execSync('npx tsx prisma/seed-demo-user.ts', { stdio: 'inherit' })
