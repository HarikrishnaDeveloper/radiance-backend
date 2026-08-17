// One-time setup: creates the ₹30/month "unlock everything" Razorpay Plan
// and prints its id — paste that into RAZORPAY_PLAN_ID in .env.
// Usage: tsx scripts/create-razorpay-plan.ts
import fs from "fs";
import path from "path";

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env first.");
    process.exit(1);
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: "Radiance Premium (Monthly)",
        amount: 3000, // paise = ₹30
        currency: "INR",
        description: "Unlimited access to all stages",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Failed to create plan:", data);
    process.exit(1);
  }

  console.log(`Plan created: ${data.id}`);
  console.log(`Add to .env: RAZORPAY_PLAN_ID=${data.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
