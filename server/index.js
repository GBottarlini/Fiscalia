import "dotenv/config";
import { createApp } from "./app.js";
import { createLocalCsvStorage } from "./storage.js";

const port = process.env.PORT || 3001;
const host = "0.0.0.0";
const storage = createLocalCsvStorage();
const app = createApp({ storage });

try {
  await storage.ensureAll();
  app.listen(port, host, () => {
    console.log(`Fiscalia API listening on ${host}:${port}`);
    console.log(`CSV storage: ${storage.location}`);
  });
} catch (error) {
  console.error("Failed to initialize local CSV storage", error);
  process.exit(1);
}
