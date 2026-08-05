import 'dotenv/config'
import { hashPassword } from '../lib/password'
import { prisma } from '../lib/prisma'

// Login screen always sends the phone number prefixed with +91 as the
// username (see src/app/login.tsx handleLogin), matching how real accounts
// get `username` set to their full phone number after setting a password.
const DEMO_USERNAME = '+918072542190'
const DEMO_PASSWORD = 'Elakki@123'

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const user = await prisma.user.upsert({
    where: { username: DEMO_USERNAME },
    update: { passwordHash },
    create: { username: DEMO_USERNAME, passwordHash, name: 'Radiance Test' },
  })
  console.log('Seeded demo user:', { id: user.id, username: user.username })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
