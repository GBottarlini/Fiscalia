import crypto from "crypto";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

const passwordArg = process.argv.slice(2).join(" ");

async function main() {
  let password = passwordArg;
  if (!password) {
    const rl = createInterface({ input, output });
    password = await rl.question("Password: ");
    rl.close();
  }

  if (!password) {
    console.error("Password is required.");
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  console.log(`${salt}:${hash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
