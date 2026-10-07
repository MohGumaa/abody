import "dotenv/config";
import { promoteToAdmin, type PromoteResult } from "../lib/admin-role";
import { db } from "../lib/db";

// Usage: pnpm admin:promote <email>
// Gives an existing registered account the admin role.

const MESSAGES: Record<PromoteResult, string> = {
  promoted: "is now an admin.",
  "already-admin": "is already an admin.",
  "not-found": "has no account. Register it on the site first.",
  "invalid-email": "is not a valid email address.",
};

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm admin:promote <email>");
    process.exitCode = 1;
    return;
  }
  const result = await promoteToAdmin(email);
  const line = `${email.trim()} ${MESSAGES[result]}`;
  if (result === "promoted" || result === "already-admin") {
    console.log(line);
  } else {
    console.error(line);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
