import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { fetchClaudeData, fetchCopilotData } from "./services/ai.service.js";
import { scrapeWisprData } from "./integrations/wispr/wisprScraper.js";

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Resolve or import credentials/globals
const anthropicKey = process.env.STANDARD_ANTHROPIC_KEY;
const ghToken = process.env.GITHUB_TOKEN;
const ghOrg = process.env.GITHUB_ORG;

// 3. Initialize the Express Application
const app = express();

// 4. Global Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public"))); // Serves your frontend index.html

// 5. Place your dynamic API Route right here
app.get("/api/dashboard-data", async (req, res) => {
  try {
    // Resolve keys/tokens from global references
    const aKey =
      typeof anthropicKey === "function" ? anthropicKey() : anthropicKey;
    const gToken = typeof ghToken === "function" ? ghToken() : ghToken;
    const gOrg = typeof ghOrg === "function" ? ghOrg() : ghOrg;

    // Fetch data concurrently using resolved credentials
    const [claudeData, copilotData, wisprData] = await Promise.all([
      fetchClaudeData(aKey),
      fetchCopilotData(gToken, gOrg),
      scrapeWisprData(process.env.WISPR_EMAIL, process.env.WISPR_PASSWORD),
    ]);

    // Construct the response payload
    const responsePayload = {
      generated_at: new Date().toISOString(),
      is_sample: false,
      claude: claudeData.claude || [],
      claude_seats: claudeData.claude_seats || [],
      copilot: copilotData.copilot || [],
      copilot_seats: copilotData.copilot_seats || [],
      org_ai_credits: copilotData.org_ai_credits || {},
      wispr: wisprData || {},
    };

    // Store log entry (Ensure 'logger' is available globally or imported)
    if (typeof logger !== "undefined") {
      logger.debug(
        "Successfully aggregated real-time dashboard data",
        responsePayload
      );
    }

    // Send payload back to the client
    res.json(responsePayload);
  } catch (error) {
    if (typeof logger !== "undefined") {
      logger.error(`Dashboard data aggregation failed: ${error.message}`, {
        error,
      });
    }

    res.status(500).json({
      error: "Failed to aggregate dashboard data",
      details: error.message,
    });
  }
});

// 6. Export the app instance for your runner script (e.g., server.js)
export default app;
