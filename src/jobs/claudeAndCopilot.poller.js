import cron from "node-cron";
import { fetchClaudeData, fetchCopilotData } from "../services/ai.service.js";
import { logger } from "../utils/winston.logger.js";
import { scrapeWisprData } from "../integrations/wispr/wisprScraper.js";

const scheduleFrequency = "0 * * * *"; // Every hour at minute 0
// const scheduleFrequency = "* * * * *"; // Every minute
let isRunning = false;

logger.info(`Scheduler initialized with frequency: ${scheduleFrequency}`);
// 2. Resolve or import credentials/globals
const anthropicKey = process.env.STANDARD_ANTHROPIC_KEY;
const ghToken = process.env.GITHUB_TOKEN;
const ghOrg = process.env.GITHUB_ORG;

cron.schedule(scheduleFrequency, async () => {
  logger.info("⏰ Cron tick fired");
  if (isRunning) {
    logger.warn("Scheduler skipped — previous job still running");
    return;
  }
  // Resolve keys/tokens from global references
  const aKey =
    typeof anthropicKey === "function" ? anthropicKey() : anthropicKey;
  const gToken = typeof ghToken === "function" ? ghToken() : ghToken;
  const gOrg = typeof ghOrg === "function" ? ghOrg() : ghOrg;

  let isRefreshData = true;

  isRunning = true;
  try {
    const results = await Promise.allSettled([
      fetchClaudeData(aKey, isRefreshData),
      fetchCopilotData(gToken, gOrg, isRefreshData),
      scrapeWisprData(process.env.WISPR_EMAIL, process.env.WISPR_PASSWORD),
    ]);

    // Log individual failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const serviceName = index === 0 ? "Claude" : "Copilot";
        logger.error(`${serviceName} fetch failed`, { reason: result.reason });
      }
    });
  } catch (error) {
    logger.error("Scheduler error", {
      message: error.message,
      status: error?.status,
      responseData: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
    });
  } finally {
    isRunning = false;
  }
});
