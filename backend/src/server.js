import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.resolve(__dirname, "../.env");
const rootEnvPath = path.resolve(__dirname, "../../.env");

if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: true });
}

const { default: app } = await import("./app.js");

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
