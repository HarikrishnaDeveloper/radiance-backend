// Marks (or unmarks) an account as a test user — test users always pass the
// subscription gate (lib/entitlement.ts), regardless of free-stage usage or
// payment status. Look the account up by phone or username.
// Usage: tsx scripts/set-test-user.ts <phoneOrUsername> [true|false]
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [, , identifier, flag] = process.argv;
  if (!identifier) {
    console.error("Usage: tsx scripts/set-test-user.ts <phoneOrUsername> [true|false]");
    process.exit(1);
  }
  const isTestUser = flag !== "false";

  const user = await prisma.user.findFirst({
    where: { OR: [{ phone: identifier }, { username: identifier }] },
  });
  if (!user) {
    console.error(`No user found with phone/username "${identifier}"`);
    process.exit(1);
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { isTestUser } });
  console.log(`${updated.username ?? updated.phone}: isTestUser = ${updated.isTestUser}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
