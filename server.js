import "./bootstrap.js";
import app from "./src/app.js";
import { logger } from "./src/index.js";
import { getHubspotClient } from "./src/configs/hubspot.config.js";
import "./src/jobs/claudeAndCopilot.poller.js";
import { scrapeWisprData } from "./src/integrations/wispr/wisprScraper.js";

// Start the server, For CI/CD deployments remove deploy.yml from .gitignore
// npm i express axios node-cron winston winston-daily-rotate-file dotenv @mohammadsaddam-dev/hubspot-toolkit
// remove git from your repo rmdir /s /q .git

const PORT = process.env.PORT || 5000;

function serverInit() {
  try {
    // Server is up and running

    app.listen(PORT, () => {
      logger.info(`Server running on PORT:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    init(); // Initialize other services and forget about them
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

serverInit();

async function init() {
  try {
    // Initialize Hubspot Client
    try {
      // const client = getHubspotClient();
      // logger.info(
      //   `✅ HubSpot client initialized successfully : ${JSON.stringify(
      //     client,
      //     null,
      //     2
      //   )}`
      // );
      // logger.info(`✅ HubSpot client initialized successfully`);
    } catch (error) {
      logger.error("❌ HubSpot client failed to initialize:", error);
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}
