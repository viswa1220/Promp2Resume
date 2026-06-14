import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load backend/.env by absolute path so it works regardless of the directory
// the process was started from.
const here = dirname(fileURLToPath(import.meta.url)); // .../backend/src
dotenv.config({ path: resolve(here, "../.env") });
