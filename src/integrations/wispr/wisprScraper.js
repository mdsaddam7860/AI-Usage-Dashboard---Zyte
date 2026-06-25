// The core automation script
import puppeteer from "puppeteer";
import { WISPR_SELECTORS, WISPR_URLS } from "./selectors.js";
import { getBrowserConfig } from "../../configs/browserConfig.js";
import { logger } from "../../index.js";
import { readCache, writeCache } from "../../utils/helper.js";

import fs from "fs";
import path from "path";

// ── Cache helpers ──────────────────────────────────────
const CACHE_DIR = path.resolve(".cache");
const WISPR_CACHE_FILE = "wispr_data.json";

const DEBUG_DIR = "./debug-output";

const dumpDebugInfo = async (page, label) => {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

    const safeLabel = label.replace(/[^a-z0-9-_]/gi, "_");
    const screenshotPath = path.join(DEBUG_DIR, `${safeLabel}.png`);
    const htmlPath = path.join(DEBUG_DIR, `${safeLabel}.html`);

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);

    const fieldsInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input")).map(
        (el) => ({
          tag: "input",
          name: el.name || null,
          id: el.id || null,
          type: el.type || null,
          placeholder: el.placeholder || null,
          visible: !!(el.offsetWidth || el.offsetHeight),
        })
      );
      const buttons = Array.from(document.querySelectorAll("button")).map(
        (el) => ({
          tag: "button",
          text: el.innerText?.trim().slice(0, 50) || null,
          type: el.type || null,
          visible: !!(el.offsetWidth || el.offsetHeight),
        })
      );
      return { inputs, buttons, url: window.location.href };
    });

    logger.info(`[DEBUG:${label}] URL: ${fieldsInfo.url}`);
    logger.info(
      `[DEBUG:${label}] Inputs found: ${JSON.stringify(
        fieldsInfo.inputs,
        null,
        2
      )}`
    );
    logger.info(
      `[DEBUG:${label}] Buttons found: ${JSON.stringify(
        fieldsInfo.buttons,
        null,
        2
      )}`
    );
    logger.info(`[DEBUG:${label}] Screenshot saved: ${screenshotPath}`);
    logger.info(`[DEBUG:${label}] HTML saved: ${htmlPath}`);
  } catch (dumpError) {
    logger.error(
      `[DEBUG:${label}] Failed to dump debug info: ${dumpError.message}`
    );
  }
};

async function scrapeWisprData(email, pass, isRefreshData = false) {
  if (!email || !pass) return null;
  // 1. Try file cache first
  const cached = readCache(WISPR_CACHE_FILE);
  if (cached && !isRefreshData) {
    logger.debug("Wispr: loaded from file cache");
    return cached;
  }
  logger.info("Initializing Wispr scraper...");
  const browser = await puppeteer.launch(getBrowserConfig(true));
  const page = await browser.newPage();

  const wisprData = {
    as_of: new Date().toISOString().split("T")[0],
    members: 0,
    active_seats: 0,
    billed_seats: 0,
    words_dictated_all_time: 0,
    words_delta_pct: 0.0,
    words_delta_window: "prior 7 days",
    users: [],
  };

  try {
    // 1. LOGIN
    logger.info("Navigating to login page...");
    await page.goto(WISPR_URLS.login, { waitUntil: "networkidle2" });
    await dumpDebugInfo(page, "01-login-page-initial");

    // --- COOKIE HANDLING ---
    try {
      logger.info("Checking for cookie consent popup...");
      await page.waitForSelector(WISPR_SELECTORS.login.cookieAcceptButton, {
        visible: true,
        timeout: 5000,
      });
      logger.info("Cookie popup found! Clicking accept...");
      await page.click(WISPR_SELECTORS.login.cookieAcceptButton);
      await new Promise((r) => setTimeout(r, 1000));
    } catch (cookieError) {
      logger.info("No cookie popup detected, proceeding normally...");
    }

    logger.info("Waiting for email field to render...");
    await page.waitForSelector(WISPR_SELECTORS.login.emailInput, {
      visible: true,
      timeout: 15000,
    });

    logger.info("Filling in email...");
    await page.type(WISPR_SELECTORS.login.emailInput, email, { delay: 30 });
    await dumpDebugInfo(page, "02-after-email-typed");

    const passwordFieldExists = await page
      .$(WISPR_SELECTORS.login.passwordInput)
      .then((el) => !!el);

    if (!passwordFieldExists) {
      logger.info(
        "Password field not present yet — attempting multi-step continue..."
      );
      await Promise.race([
        page.click(WISPR_SELECTORS.login.continueButton).catch(() => null),
        page.keyboard.press("Enter").catch(() => null),
      ]);
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
        .catch(() =>
          logger.info(
            "No full navigation after continue click (likely SPA transition)"
          )
        );
      await new Promise((r) => setTimeout(r, 1500));
      await dumpDebugInfo(page, "03-after-continue-click");
      logger.info("Waiting for password field to render...");
      await page.waitForSelector(WISPR_SELECTORS.login.passwordInput, {
        visible: true,
        timeout: 15000,
      });
    }

    logger.info("Filling in password...");
    await page.type(WISPR_SELECTORS.login.passwordInput, pass, { delay: 30 });
    await dumpDebugInfo(page, "04-after-password-typed");

    logger.info("Submitting login form...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
      page.click(WISPR_SELECTORS.login.submitButton),
    ]);

    const postLoginUrl = page.url();
    logger.info(`Post-login URL: ${postLoginUrl}`);
    await dumpDebugInfo(page, "05-post-login");

    if (
      postLoginUrl.includes("/get-started") ||
      postLoginUrl.includes("/login")
    ) {
      throw new Error(
        `Login appears to have failed — still on ${postLoginUrl}`
      );
    }

    // 2. USAGE DATA
    logger.info("Extracting usage metrics...");
    await page.goto(WISPR_URLS.usage, { waitUntil: "networkidle2" });

    await page.waitForSelector(WISPR_SELECTORS.usage.wordsDictated, {
      visible: true,
      timeout: 15000,
    });
    await dumpDebugInfo(page, "06-usage-page");

    // ── Graceful extraction: words dictation ──────────────────
    try {
      const wordsRaw = await page.$eval(
        WISPR_SELECTORS.usage.wordsDictated,
        (el) => el.innerText
      );
      const wordsMatch = wordsRaw.replace(/,/g, "").match(/\d+/);
      wisprData.words_dictated_all_time = wordsMatch
        ? parseInt(wordsMatch[0], 10)
        : 0;
    } catch (err) {
      logger.warn(
        `Failed to extract words_dictated_all_time, using default 0: ${err.message}`
      );
    }

    // ── Graceful extraction: trend ────────────────────────────
    try {
      const trendRaw = await page.$eval(
        WISPR_SELECTORS.usage.trend,
        (el) => el.innerText
      );
      const trendMatch = trendRaw.match(/[\d.]+/);
      wisprData.words_delta_pct = trendMatch ? parseFloat(trendMatch[0]) : 0.0;

      const windowMatch = trendRaw.match(/from (.*)/);
      if (windowMatch) wisprData.words_delta_window = windowMatch[1].trim();
    } catch (err) {
      logger.warn(
        `Failed to extract words trend, using default 0% / prior 7 days: ${err.message}`
      );
    }

    // 3. TEAM DATA (summary + user table)
    logger.info("Extracting team seat metrics and user list...");
    await page.goto(WISPR_URLS.team, { waitUntil: "networkidle2" });

    await page.waitForSelector(WISPR_SELECTORS.team.summary, {
      visible: true,
      timeout: 15000,
    });
    await dumpDebugInfo(page, "07-team-page");

    // ── Graceful extraction: team summary ─────────────────────
    try {
      const teamSummaryRaw = await page.$eval(
        WISPR_SELECTORS.team.summary,
        (el) => el.innerText
      );
      const billedSeatsMatch = teamSummaryRaw.match(/of (\d+) billed seats/);
      const membersMatch = teamSummaryRaw.match(/across (\d+) members/);

      if (billedSeatsMatch)
        wisprData.billed_seats = parseInt(billedSeatsMatch[1], 10);
      if (membersMatch) wisprData.members = parseInt(membersMatch[1], 10);
    } catch (err) {
      logger.warn(
        `Failed to extract team summary, keeping members/billed_seats at 0: ${err.message}`
      );
    }

    // ── NEW: extract user table ───────────────────────────────
    try {
      await page.waitForSelector('[class*="_userRow_"]', { timeout: 8000 });

      const users = await page.evaluate(() => {
        const rows = document.querySelectorAll('[class*="_userRow_"]');

        return Array.from(rows).map((row) => {
          // Image
          const avatarImg = row.querySelector('[class*="_profile_"] img');
          const image_url = avatarImg ? avatarImg.getAttribute("src") : "";

          // Name
          const nameEl = row.querySelector('[class*="_name_"]');
          let name = "";
          if (nameEl) {
            const clone = nameEl.cloneNode(true);
            const selfTags = clone.querySelectorAll('[class*="_selfTag_"]');
            selfTags.forEach((tag) => tag.remove());
            name = clone.textContent.trim();
          }

          // Email
          const emailEl = row.querySelector('[class*="_email_"]');
          const email = emailEl ? emailEl.textContent.trim() : "";

          // Status
          const trialStatusEl = row.querySelector(
            '[class*="_trialStatusText_"]'
          );
          let status = "active";
          if (trialStatusEl) {
            const trialText = trialStatusEl.textContent.trim().toLowerCase();
            if (trialText.includes("trial")) status = "trialing";
            else if (trialText === "active") status = "active";
            else status = trialText;
          } else {
            const roleEl = row.querySelector('[class*="_role_"]');
            if (
              roleEl &&
              roleEl.textContent.trim().toLowerCase() === "pending"
            ) {
              status = "pending";
            }
          }

          // Role
          const selectMainTextEl = row.querySelector(
            '[class*="_selectMainText_"]'
          );
          let role = "";
          if (selectMainTextEl) {
            role = selectMainTextEl.textContent.trim();
          } else {
            const roleEl = row.querySelector('[class*="_role_"]');
            if (roleEl) role = roleEl.textContent.trim();
          }

          return { image_url, name, email, status, role };
        });
      });

      wisprData.users = users;
      logger.info(`Extracted ${users.length} user(s) from team table`);
    } catch (userErr) {
      logger.warn(
        `Failed to extract user table, defaulting to empty array: ${userErr.message}`
      );
      wisprData.users = [];
    }

    // ── Graceful extraction: bucket counts ────────────────────
    let bucketCounts = [];
    let bucketLabels = [];
    try {
      bucketCounts = await page.$$eval(
        WISPR_SELECTORS.team.bucketCount,
        (els) => els.map((el) => el.innerText.trim())
      );
    } catch (err) {
      logger.warn(
        `Failed to extract bucket counts, using empty array: ${err.message}`
      );
    }

    try {
      bucketLabels = await page.$$eval(
        WISPR_SELECTORS.team.bucketLabel,
        (els) => els.map((el) => el.innerText.trim())
      );
    } catch (err) {
      logger.warn(
        `Failed to extract bucket labels, using empty array: ${err.message}`
      );
    }

    const buckets = {};
    bucketLabels.forEach((label, i) => {
      const count =
        parseInt((bucketCounts[i] || "0").replace(/,/g, ""), 10) || 0;
      buckets[label] = count;
    });
    logger.info(`Team seat buckets: ${JSON.stringify(buckets)}`);

    wisprData.active_seats = buckets["Paid seats"] ?? 0;

    logger.info("Scraping completed successfully.");
    logger.info(`Final scraped data: ${JSON.stringify(wisprData)}`);

    // ── Write to cache ──────────────────────────────────────
    try {
      if (!fs.existsSync(CACHE_DIR))
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      writeCache(WISPR_CACHE_FILE, wisprData);
      logger.info(
        `Cached scraped data to ${path.join(CACHE_DIR, WISPR_CACHE_FILE)}`
      );
    } catch (cacheWriteError) {
      logger.error(`Failed to write cache: ${cacheWriteError.message}`);
    }

    return wisprData;
  } catch (error) {
    logger.error(`Scraper failed: `, {
      status: error?.response?.status || error?.status,
      message: error.message,
      response: error?.response?.data,
      stack: error.stack,
    });
    await dumpDebugInfo(page, "99-failure-state");

    // ── Fall back to last known good cache on failure ──────────
    try {
      const cached = await readCache(WISPR_CACHE_FILE);
      if (cached) {
        logger.info("Returning last cached Wispr data after scrape failure.");
        return cached;
      }
    } catch (cacheReadError) {
      logger.error(`Failed to read cache fallback: ${cacheReadError.message}`);
    }

    return null;
  } finally {
    await browser.close();
  }
}

export { scrapeWisprData };

// export const scrapeWisprData = async (email, pass, isRefreshData = false) => {
//   if (!email || !pass) return null;
//   // 1. Try file cache first
//   const cached = readCache(WISPR_CACHE_FILE);
//   if (cached && !isRefreshData) {
//     logger.debug("Wispr: loaded from file cache");
//     return cached;
//   }
//   logger.info("Initializing Wispr scraper...");
//   const browser = await puppeteer.launch(getBrowserConfig(true));
//   const page = await browser.newPage();

//   const wisprData = {
//     as_of: new Date().toISOString().split("T")[0],
//     members: 0,
//     active_seats: 0,
//     billed_seats: 0,
//     words_dictated_all_time: 0,
//     words_delta_pct: 0.0,
//     words_delta_window: "prior 7 days",
//   };

//   try {
//     // 1. LOGIN
//     logger.info("Navigating to login page...");
//     await page.goto(WISPR_URLS.login, { waitUntil: "networkidle2" });
//     await dumpDebugInfo(page, "01-login-page-initial");

//     // --- COOKIE HANDLING ---
//     try {
//       logger.info("Checking for cookie consent popup...");
//       await page.waitForSelector(WISPR_SELECTORS.login.cookieAcceptButton, {
//         visible: true,
//         timeout: 5000,
//       });
//       logger.info("Cookie popup found! Clicking accept...");
//       await page.click(WISPR_SELECTORS.login.cookieAcceptButton);
//       await new Promise((r) => setTimeout(r, 1000));
//     } catch (cookieError) {
//       logger.info("No cookie popup detected, proceeding normally...");
//     }

//     logger.info("Waiting for email field to render...");
//     await page.waitForSelector(WISPR_SELECTORS.login.emailInput, {
//       visible: true,
//       timeout: 15000,
//     });

//     logger.info("Filling in email...");
//     await page.type(WISPR_SELECTORS.login.emailInput, email, { delay: 30 });
//     await dumpDebugInfo(page, "02-after-email-typed");

//     const passwordFieldExists = await page
//       .$(WISPR_SELECTORS.login.passwordInput)
//       .then((el) => !!el);

//     if (!passwordFieldExists) {
//       logger.info(
//         "Password field not present yet — attempting multi-step continue..."
//       );
//       await Promise.race([
//         page.click(WISPR_SELECTORS.login.continueButton).catch(() => null),
//         page.keyboard.press("Enter").catch(() => null),
//       ]);
//       await page
//         .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
//         .catch(() =>
//           logger.info(
//             "No full navigation after continue click (likely SPA transition)"
//           )
//         );
//       await new Promise((r) => setTimeout(r, 1500));
//       await dumpDebugInfo(page, "03-after-continue-click");
//       logger.info("Waiting for password field to render...");
//       await page.waitForSelector(WISPR_SELECTORS.login.passwordInput, {
//         visible: true,
//         timeout: 15000,
//       });
//     }

//     logger.info("Filling in password...");
//     await page.type(WISPR_SELECTORS.login.passwordInput, pass, { delay: 30 });
//     await dumpDebugInfo(page, "04-after-password-typed");

//     logger.info("Submitting login form...");
//     await Promise.all([
//       page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
//       page.click(WISPR_SELECTORS.login.submitButton),
//     ]);

//     const postLoginUrl = page.url();
//     logger.info(`Post-login URL: ${postLoginUrl}`);
//     await dumpDebugInfo(page, "05-post-login");

//     if (
//       postLoginUrl.includes("/get-started") ||
//       postLoginUrl.includes("/login")
//     ) {
//       throw new Error(
//         `Login appears to have failed — still on ${postLoginUrl}`
//       );
//     }

//     // 2. USAGE DATA
//     logger.info("Extracting usage metrics...");
//     await page.goto(WISPR_URLS.usage, { waitUntil: "networkidle2" });

//     await page.waitForSelector(WISPR_SELECTORS.usage.wordsDictated, {
//       visible: true,
//       timeout: 15000,
//     });
//     await dumpDebugInfo(page, "06-usage-page");

//     // ── Graceful extraction: words dictation ──────────────────
//     try {
//       const wordsRaw = await page.$eval(
//         WISPR_SELECTORS.usage.wordsDictated,
//         (el) => el.innerText
//       );
//       const wordsMatch = wordsRaw.replace(/,/g, "").match(/\d+/);
//       wisprData.words_dictated_all_time = wordsMatch
//         ? parseInt(wordsMatch[0], 10)
//         : 0;
//     } catch (err) {
//       logger.warn(
//         `Failed to extract words_dictated_all_time, using default 0: ${err.message}`
//       );
//     }

//     // ── Graceful extraction: trend ────────────────────────────
//     try {
//       const trendRaw = await page.$eval(
//         WISPR_SELECTORS.usage.trend,
//         (el) => el.innerText
//       );
//       const trendMatch = trendRaw.match(/[\d.]+/);
//       wisprData.words_delta_pct = trendMatch ? parseFloat(trendMatch[0]) : 0.0;

//       const windowMatch = trendRaw.match(/from (.*)/);
//       if (windowMatch) wisprData.words_delta_window = windowMatch[1].trim();
//     } catch (err) {
//       logger.warn(
//         `Failed to extract words trend, using default 0% / prior 7 days: ${err.message}`
//       );
//     }

//     // 3. TEAM DATA
//     logger.info("Extracting team seat metrics...");
//     await page.goto(WISPR_URLS.team, { waitUntil: "networkidle2" });

//     await page.waitForSelector(WISPR_SELECTORS.team.summary, {
//       visible: true,
//       timeout: 15000,
//     });
//     await dumpDebugInfo(page, "07-team-page");

//     // ── Graceful extraction: team summary ─────────────────────
//     try {
//       const teamSummaryRaw = await page.$eval(
//         WISPR_SELECTORS.team.summary,
//         (el) => el.innerText
//       );
//       const billedSeatsMatch = teamSummaryRaw.match(/of (\d+) billed seats/);
//       const membersMatch = teamSummaryRaw.match(/across (\d+) members/);

//       if (billedSeatsMatch)
//         wisprData.billed_seats = parseInt(billedSeatsMatch[1], 10);
//       if (membersMatch) wisprData.members = parseInt(membersMatch[1], 10);
//     } catch (err) {
//       logger.warn(
//         `Failed to extract team summary, keeping members/billed_seats at 0: ${err.message}`
//       );
//     }

//     // ── Graceful extraction: bucket counts ────────────────────
//     let bucketCounts = [];
//     let bucketLabels = [];
//     try {
//       bucketCounts = await page.$$eval(
//         WISPR_SELECTORS.team.bucketCount,
//         (els) => els.map((el) => el.innerText.trim())
//       );
//     } catch (err) {
//       logger.warn(
//         `Failed to extract bucket counts, using empty array: ${err.message}`
//       );
//     }

//     try {
//       bucketLabels = await page.$$eval(
//         WISPR_SELECTORS.team.bucketLabel,
//         (els) => els.map((el) => el.innerText.trim())
//       );
//     } catch (err) {
//       logger.warn(
//         `Failed to extract bucket labels, using empty array: ${err.message}`
//       );
//     }

//     const buckets = {};
//     bucketLabels.forEach((label, i) => {
//       const count =
//         parseInt((bucketCounts[i] || "0").replace(/,/g, ""), 10) || 0;
//       buckets[label] = count;
//     });
//     logger.info(`Team seat buckets: ${JSON.stringify(buckets)}`);

//     wisprData.active_seats = buckets["Paid seats"] ?? 0;

//     logger.info("Scraping completed successfully.");
//     logger.info(`Final scraped data: ${JSON.stringify(wisprData)}`);

//     // ── Write to cache ──────────────────────────────────────
//     try {
//       if (!fs.existsSync(CACHE_DIR))
//         fs.mkdirSync(CACHE_DIR, { recursive: true });
//       writeCache(WISPR_CACHE_FILE, wisprData);
//       logger.info(
//         `Cached scraped data to ${path.join(CACHE_DIR, WISPR_CACHE_FILE)}`
//       );
//     } catch (cacheWriteError) {
//       logger.error(`Failed to write cache: ${cacheWriteError.message}`);
//     }

//     return wisprData;
//   } catch (error) {
//     logger.error(`Scraper failed: `, {
//       status: error?.response?.status || error?.status,
//       message: error.message,
//       response: error?.response?.data,
//       stack: error.stack,
//     });
//     await dumpDebugInfo(page, "99-failure-state");

//     // ── Fall back to last known good cache on failure ──────────
//     try {
//       const cached = await readCache(WISPR_CACHE_FILE);
//       if (cached) {
//         logger.info("Returning last cached Wispr data after scrape failure.");
//         return cached;
//       }
//     } catch (cacheReadError) {
//       logger.error(`Failed to read cache fallback: ${cacheReadError.message}`);
//     }

//     return null;
//   } finally {
//     await browser.close();
//   }
// };
