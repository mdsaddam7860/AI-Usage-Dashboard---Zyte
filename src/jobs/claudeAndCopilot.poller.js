import cron from "node-cron";
import { fetchClaudeData, fetchCopilotData } from "../services/ai.service.js";
import { logger } from "../utils/winston.logger.js";

const scheduleFrequency = "0 * * * *"; // Every hour at minute 0
// const scheduleFrequency = "* * * * *"; // Every minute
let isRunning = false;

logger.info(`Scheduler initialized with frequency: ${scheduleFrequency}`);

cron.schedule(scheduleFrequency, async () => {
  logger.info("⏰ Cron tick fired");
  if (isRunning) {
    logger.warn("Scheduler skipped — previous job still running");
    return;
  }

  isRunning = true;
  try {
    const results = await Promise.allSettled([
      fetchClaudeData(),
      fetchCopilotData(),
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
