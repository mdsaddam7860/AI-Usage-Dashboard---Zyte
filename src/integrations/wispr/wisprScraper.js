import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WISPR_SELECTORS, WISPR_URLS } from "./selectors.js";
import { getBrowserConfig } from "../../configs/browserConfig.js";
import { logger } from "../../index.js";
import { readCache, writeCache } from "../../utils/helper.js";

const CACHE_DIR = path.resolve(".cache");
const WISPR_CACHE_FILE = "wispr_data.json";
const DEBUG_DIR = "./debug-output";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GOOGLE_PROFILE_DIR = path.join(__dirname, "google-session-profile");

// ── Cache helpers ──────────────────────────────────────
// const CACHE_DIR = path.resolve(".cache");
// const WISPR_CACHE_FILE = "wispr_data.json";

// const DEBUG_DIR = "./debug-output";

// const dumpDebugInfo = async (page, label) => {
//   try {
//     if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

//     const safeLabel = label.replace(/[^a-z0-9-_]/gi, "_");
//     const screenshotPath = path.join(DEBUG_DIR, `${safeLabel}.png`);
//     const htmlPath = path.join(DEBUG_DIR, `${safeLabel}.html`);

//     await page.screenshot({ path: screenshotPath, fullPage: true });
//     const html = await page.content();
//     fs.writeFileSync(htmlPath, html);

//     const fieldsInfo = await page.evaluate(() => {
//       const inputs = Array.from(document.querySelectorAll("input")).map(
//         (el) => ({
//           tag: "input",
//           name: el.name || null,
//           id: el.id || null,
//           type: el.type || null,
//           placeholder: el.placeholder || null,
//           visible: !!(el.offsetWidth || el.offsetHeight),
//         })
//       );
//       const buttons = Array.from(document.querySelectorAll("button")).map(
//         (el) => ({
//           tag: "button",
//           text: el.innerText?.trim().slice(0, 50) || null,
//           type: el.type || null,
//           visible: !!(el.offsetWidth || el.offsetHeight),
//         })
//       );
//       return { inputs, buttons, url: window.location.href };
//     });

//     logger.info(`[DEBUG:${label}] URL: ${fieldsInfo.url}`);
//     logger.info(
//       `[DEBUG:${label}] Inputs found: ${JSON.stringify(
//         fieldsInfo.inputs,
//         null,
//         2
//       )}`
//     );
//     logger.info(
//       `[DEBUG:${label}] Buttons found: ${JSON.stringify(
//         fieldsInfo.buttons,
//         null,
//         2
//       )}`
//     );
//     logger.info(`[DEBUG:${label}] Screenshot saved: ${screenshotPath}`);
//     logger.info(`[DEBUG:${label}] HTML saved: ${htmlPath}`);
//   } catch (dumpError) {
//     logger.error(
//       `[DEBUG:${label}] Failed to dump debug info: ${dumpError.message}`
//     );
//   }
// };
// // Working Code With USername and password
// async function scrapeWisprData(email, pass, isRefreshData = false) {
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
//     users: [],
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

//     // 3. TEAM DATA (summary + user table)
//     logger.info("Extracting team seat metrics and user list...");
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

//     // ── NEW: extract user table ───────────────────────────────
//     try {
//       await page.waitForSelector('[class*="_userRow_"]', { timeout: 8000 });

//       const users = await page.evaluate(() => {
//         const rows = document.querySelectorAll('[class*="_userRow_"]');

//         return Array.from(rows).map((row) => {
//           // Image
//           const avatarImg = row.querySelector('[class*="_profile_"] img');
//           const image_url = avatarImg ? avatarImg.getAttribute("src") : "";

//           // Name
//           const nameEl = row.querySelector('[class*="_name_"]');
//           let name = "";
//           if (nameEl) {
//             const clone = nameEl.cloneNode(true);
//             const selfTags = clone.querySelectorAll('[class*="_selfTag_"]');
//             selfTags.forEach((tag) => tag.remove());
//             name = clone.textContent.trim();
//           }

//           // Email
//           const emailEl = row.querySelector('[class*="_email_"]');
//           const email = emailEl ? emailEl.textContent.trim() : "";

//           // Status
//           const trialStatusEl = row.querySelector(
//             '[class*="_trialStatusText_"]'
//           );
//           let status = "active";
//           if (trialStatusEl) {
//             const trialText = trialStatusEl.textContent.trim().toLowerCase();
//             if (trialText.includes("trial")) status = "trialing";
//             else if (trialText === "active") status = "active";
//             else status = trialText;
//           } else {
//             const roleEl = row.querySelector('[class*="_role_"]');
//             if (
//               roleEl &&
//               roleEl.textContent.trim().toLowerCase() === "pending"
//             ) {
//               status = "pending";
//             }
//           }

//           // Role
//           const selectMainTextEl = row.querySelector(
//             '[class*="_selectMainText_"]'
//           );
//           let role = "";
//           if (selectMainTextEl) {
//             role = selectMainTextEl.textContent.trim();
//           } else {
//             const roleEl = row.querySelector('[class*="_role_"]');
//             if (roleEl) role = roleEl.textContent.trim();
//           }

//           return { image_url, name, email, status, role };
//         });
//       });

//       wisprData.users = users;
//       logger.info(`Extracted ${users.length} user(s) from team table`);
//     } catch (userErr) {
//       logger.warn(
//         `Failed to extract user table, defaulting to empty array: ${userErr.message}`
//       );
//       wisprData.users = [];
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
// }

// ── Cookie helpers ─────────────────────────────────────────────────────────

/**
 * Loads cookies from WISPR_COOKIES env var (base64) or wispr-cookies.json fallback.
 * Returns an array of cookie objects, or null if neither source is available.
 */
function loadCookies() {
  // Primary: base64-encoded env var (paste from get-wispr-cookies.js output)
  if (process.env.WISPR_COOKIES) {
    try {
      const decoded = Buffer.from(process.env.WISPR_COOKIES, "base64").toString(
        "utf8"
      );
      const cookies = JSON.parse(decoded);
      logger.info(
        `Loaded ${cookies.length} cookies from WISPR_COOKIES env var`
      );
      return cookies;
    } catch (err) {
      logger.error(`Failed to parse WISPR_COOKIES env var: ${err.message}`);
    }
  }

  // Fallback: raw JSON file on disk
  const cookieFile = path.resolve("wispr-cookies.json");
  if (fs.existsSync(cookieFile)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8"));
      logger.info(`Loaded ${cookies.length} cookies from wispr-cookies.json`);
      return cookies;
    } catch (err) {
      logger.error(`Failed to parse wispr-cookies.json: ${err.message}`);
    }
  }

  return null;
}

/**
 * Returns true if the page landed on a login/auth page after cookie injection,
 * meaning the cookies have expired.
 */
function isAuthPage(url) {
  return url.includes("/login") || url.includes("/get-started");
}

// ── Debug helper ───────────────────────────────────────────────────────────

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
      `[DEBUG:${label}] Inputs: ${JSON.stringify(fieldsInfo.inputs, null, 2)}`
    );
    logger.info(
      `[DEBUG:${label}] Buttons: ${JSON.stringify(fieldsInfo.buttons, null, 2)}`
    );
    logger.info(`[DEBUG:${label}] Screenshot: ${screenshotPath}`);
  } catch (dumpError) {
    logger.error(`[DEBUG:${label}] Failed: ${dumpError.message}`);
  }
};

// ── Retry helper ───────────────────────────────────────────────────────────

async function gotoWithOrgRetry(page, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await page.goto(url, { waitUntil: "networkidle2" });

    const hasOrgLoadError = await page.evaluate(() =>
      document.body.innerText.includes("We couldn't load your organization")
    );

    if (!hasOrgLoadError) return;

    logger.warn(
      `Attempt ${attempt}/${maxRetries}: org load error on ${url}, retrying...`
    );

    const retryClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim() === "Retry"
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (retryClicked) {
      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
        .catch(() => null);
    }

    await new Promise((r) => setTimeout(r, 1200 * attempt));
  }

  throw new Error(
    `"${url}" kept showing org load error after ${maxRetries} attempts`
  );
}

// ── Main scraper ───────────────────────────────────────────────────────────
async function scrapeWisprData(
  email,
  pass,
  isRefreshData = true,
  authMethod = "password" // "password" | "google" | "cookies"
) {
  if (authMethod === "password" && (!email || !pass)) return null;

  const cached = readCache(WISPR_CACHE_FILE);
  if (cached && !isRefreshData) {
    logger.debug("Wispr: loaded from file cache");
    return cached;
  }

  logger.info("Initializing Wispr scraper...");

  let browser;

  // ── Browser launch ───────────────────────────────────────────────────────
  if (authMethod === "google") {
    if (!fs.existsSync(GOOGLE_PROFILE_DIR)) {
      logger.error(
        `Google session profile not found at ${GOOGLE_PROFILE_DIR}. ` +
          `Run "node setup-google-session.js" once to create it.`
      );
      return readCache(WISPR_CACHE_FILE) || null;
    }
    browser = await puppeteer.launch({
      ...getBrowserConfig(true),
      userDataDir: GOOGLE_PROFILE_DIR,
    });
  } else {
    // Both "password" and "cookies" use the standard config (no profile lock)
    browser = await puppeteer.launch(getBrowserConfig(true));
  }

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
    // ── 1. LOGIN ────────────────────────────────────────────────────────────

    if (authMethod === "cookies") {
      // ── Cookie auth ──────────────────────────────────────────────────────
      const cookies = loadCookies();

      if (!cookies) {
        throw new Error(
          "No cookies found. Set the WISPR_COOKIES env var (run get-wispr-cookies.js " +
            "locally to generate it) or place wispr-cookies.json in the project root."
        );
      }

      logger.info(
        "Injecting saved cookies and navigating directly to usage page..."
      );

      // Cookies must be set after visiting the domain first
      await page.goto("https://admin.wisprflow.ai", {
        waitUntil: "networkidle2",
      });
      await page.setCookie(...cookies);

      await gotoWithOrgRetry(page, WISPR_URLS.usage);
      await dumpDebugInfo(page, "c01-after-cookie-inject");

      if (isAuthPage(page.url())) {
        throw new Error(
          "Cookies have expired — re-run get-wispr-cookies.js locally, " +
            "then update the WISPR_COOKIES env var."
        );
      }

      logger.info("Cookie session is valid, proceeding...");
    } else if (authMethod === "google") {
      // ── Google profile auth ──────────────────────────────────────────────
      logger.info("Using persistent Google session — skipping login form...");
      await gotoWithOrgRetry(page, WISPR_URLS.usage);
      await dumpDebugInfo(page, "g01-direct-usage-attempt");

      if (isAuthPage(page.url())) {
        throw new Error(
          "Google session has expired. Re-run setup-google-session.js manually."
        );
      }

      logger.info("Existing Google session is valid, proceeding...");
    } else {
      // ── Password auth (original flow, unchanged) ─────────────────────────
      logger.info("Navigating to login page...");
      await page.goto(WISPR_URLS.login, { waitUntil: "networkidle2" });
      await dumpDebugInfo(page, "01-login-page-initial");

      try {
        await page.waitForSelector(WISPR_SELECTORS.login.cookieAcceptButton, {
          visible: true,
          timeout: 5000,
        });
        logger.info("Cookie popup found, clicking accept...");
        await page.click(WISPR_SELECTORS.login.cookieAcceptButton);
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        logger.info("No cookie popup detected, proceeding...");
      }

      await page.waitForSelector(WISPR_SELECTORS.login.emailInput, {
        visible: true,
        timeout: 15000,
      });

      await page.type(WISPR_SELECTORS.login.emailInput, email, { delay: 30 });
      await dumpDebugInfo(page, "02-after-email-typed");

      const passwordFieldExists = await page
        .$(WISPR_SELECTORS.login.passwordInput)
        .then((el) => !!el);

      if (!passwordFieldExists) {
        logger.info(
          "Password field not present — trying multi-step continue..."
        );
        await Promise.race([
          page.click(WISPR_SELECTORS.login.continueButton).catch(() => null),
          page.keyboard.press("Enter").catch(() => null),
        ]);
        await page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
          .catch(() =>
            logger.info("No navigation after continue (likely SPA)")
          );
        await new Promise((r) => setTimeout(r, 1500));
        await dumpDebugInfo(page, "03-after-continue-click");
        await page.waitForSelector(WISPR_SELECTORS.login.passwordInput, {
          visible: true,
          timeout: 15000,
        });
      }

      await page.type(WISPR_SELECTORS.login.passwordInput, pass, { delay: 30 });
      await dumpDebugInfo(page, "04-after-password-typed");

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        page.click(WISPR_SELECTORS.login.submitButton),
      ]);

      const postLoginUrl = page.url();
      logger.info(`Post-login URL: ${postLoginUrl}`);
      await dumpDebugInfo(page, "05-post-login");

      if (isAuthPage(postLoginUrl)) {
        throw new Error(`Login failed — still on ${postLoginUrl}`);
      }

      await gotoWithOrgRetry(page, WISPR_URLS.usage);
    }

    // ── 2. USAGE DATA (shared by all auth methods) ──────────────────────────

    // FIX: Wait specifically for the text "words dictated" to appear in a card,
    // ensuring the network request for this specific data has finished loading.
    await page.waitForFunction(
      () => {
        const titles = document.querySelectorAll('[data-slot="card-title"]');
        return Array.from(titles).some((el) =>
          /words dictated/i.test(el.textContent || "")
        );
      },
      { timeout: 15000 }
    );

    await dumpDebugInfo(page, "06-usage-page");

    try {
      const { wordsRaw, trendRaw, isNegative } = await page.evaluate(() => {
        const titles = document.querySelectorAll('[data-slot="card-title"]');
        const titleEl = Array.from(titles).find((el) =>
          /words dictated/i.test(el.textContent || "")
        );

        if (!titleEl)
          return { wordsRaw: null, trendRaw: null, isNegative: false };

        const flexContainer = titleEl.parentElement;

        // Find the specific trend SVG within the parent container
        const trendIcon = flexContainer?.querySelector(
          "svg.lucide-trending-up, svg.lucide-trending-down"
        );
        let trendText = null;
        let isNeg = false;

        if (trendIcon) {
          isNeg = trendIcon.classList.contains("lucide-trending-down");
          // The text (e.g., "6.02% from prior 7 days") is in a sibling span to the SVG
          const trendSpan = trendIcon.parentElement.querySelector("span");
          if (trendSpan) {
            trendText = trendSpan.textContent;
          }
        }

        return {
          wordsRaw: titleEl.textContent || null,
          trendRaw: trendText,
          isNegative: isNeg,
        };
      });

      if (!wordsRaw)
        throw new Error('No element matched "words dictated" text');

      // Extract number: "312,768 words dictated" → 312768
      const wordsMatch = wordsRaw.replace(/,/g, "").match(/\d+/);
      wisprData.words_dictated_all_time = wordsMatch
        ? parseInt(wordsMatch[0], 10)
        : 0;

      if (trendRaw) {
        // Extract percentage: "6.02% from prior 7 days" → 6.02
        const trendMatch = trendRaw.match(/[\d.]+/);
        const pct = trendMatch ? parseFloat(trendMatch[0]) : 0.0;
        wisprData.words_delta_pct = isNegative ? -pct : pct;

        // Extract window: "6.02% from prior 7 days" → "prior 7 days"
        const windowMatch = trendRaw.match(/from\s+(.*)/i);
        if (windowMatch) wisprData.words_delta_window = windowMatch[1].trim();
      } else {
        logger.warn("No trend element found next to words-dictated card");
      }

      logger.info(
        `Usage extracted — words: ${wisprData.words_dictated_all_time}, ` +
          `trend: ${wisprData.words_delta_pct}% (${wisprData.words_delta_window})`
      );
    } catch (err) {
      logger.warn(`Failed to extract usage card data: ${err.message}`);
    }

    // ── 3. TEAM DATA ────────────────────────────────────────────────────────
    logger.info("Extracting team seat metrics and user list...");
    await gotoWithOrgRetry(page, WISPR_URLS.team);

    await page.waitForSelector(WISPR_SELECTORS.team.summary, {
      visible: true,
      timeout: 15000,
    });
    await dumpDebugInfo(page, "07-team-page");

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
      logger.warn(`Failed to extract team summary: ${err.message}`);
    }

    try {
      await page.waitForSelector('[class*="_userRow_"]', { timeout: 8000 });

      const users = await page.evaluate(() => {
        const rows = document.querySelectorAll('[class*="_userRow_"]');
        return Array.from(rows).map((row) => {
          const avatarImg = row.querySelector('[class*="_profile_"] img');
          const image_url = avatarImg ? avatarImg.getAttribute("src") : "";

          const nameEl = row.querySelector('[class*="_name_"]');
          let name = "";
          if (nameEl) {
            const clone = nameEl.cloneNode(true);
            clone
              .querySelectorAll('[class*="_selfTag_"]')
              .forEach((t) => t.remove());
            name = clone.textContent.trim();
          }

          const emailEl = row.querySelector('[class*="_email_"]');
          const email = emailEl ? emailEl.textContent.trim() : "";

          const trialStatusEl = row.querySelector(
            '[class*="_trialStatusText_"]'
          );
          let status = "active";
          if (trialStatusEl) {
            const t = trialStatusEl.textContent.trim().toLowerCase();
            status = t.includes("trial") ? "trialing" : t || "active";
          } else {
            const roleEl = row.querySelector('[class*="_role_"]');
            if (roleEl?.textContent.trim().toLowerCase() === "pending")
              status = "pending";
          }

          const selectMainTextEl = row.querySelector(
            '[class*="_selectMainText_"]'
          );
          let role = selectMainTextEl
            ? selectMainTextEl.textContent.trim()
            : row.querySelector('[class*="_role_"]')?.textContent.trim() || "";

          return { image_url, name, email, status, role };
        });
      });

      wisprData.users = users;
      logger.info(`Extracted ${users.length} user(s) from team table`);
    } catch (userErr) {
      logger.warn(`Failed to extract user table: ${userErr.message}`);
      wisprData.users = [];
    }

    let bucketCounts = [];
    let bucketLabels = [];
    try {
      bucketCounts = await page.$$eval(
        WISPR_SELECTORS.team.bucketCount,
        (els) => els.map((el) => el.innerText.trim())
      );
    } catch (err) {
      logger.warn(`Failed to extract bucket counts: ${err.message}`);
    }
    try {
      bucketLabels = await page.$$eval(
        WISPR_SELECTORS.team.bucketLabel,
        (els) => els.map((el) => el.innerText.trim())
      );
    } catch (err) {
      logger.warn(`Failed to extract bucket labels: ${err.message}`);
    }

    const buckets = {};
    bucketLabels.forEach((label, i) => {
      buckets[label] =
        parseInt((bucketCounts[i] || "0").replace(/,/g, ""), 10) || 0;
    });
    logger.info(`Team seat buckets: ${JSON.stringify(buckets)}`);
    wisprData.active_seats = buckets["Paid seats"] ?? 0;

    logger.info("Scraping completed successfully.");
    logger.info(
      `Final scraped data: ${JSON.stringify(wisprData?.users.length)}`
    );

    try {
      if (!fs.existsSync(CACHE_DIR))
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      writeCache(WISPR_CACHE_FILE, wisprData);
      logger.info(`Cached to ${path.join(CACHE_DIR, WISPR_CACHE_FILE)}`);
    } catch (cacheWriteError) {
      logger.error(`Failed to write cache: ${cacheWriteError.message}`);
    }

    return wisprData;
  } catch (error) {
    logger.error(`Scraper failed:`, {
      status: error?.response?.status || error?.status,
      message: error.message,
      stack: error.stack,
    });
    await dumpDebugInfo(page, "99-failure-state");

    if (error.message?.includes("couldn't load organization")) {
      logger.error(
        "Wispr app failed to load org repeatedly — transient error on their side."
      );
    }

    try {
      const cached = readCache(WISPR_CACHE_FILE);
      if (cached) {
        logger.info("Returning last cached data after scrape failure.");
        return cached;
      }
    } catch (cacheReadError) {
      logger.error(`Cache fallback failed: ${cacheReadError.message}`);
    }

    return null;
  } finally {
    await browser.close();
  }
}
// async function scrapeWisprData(
//   email,
//   pass,
//   isRefreshData = true,
//   authMethod = "password" // "password" | "google" | "cookies"
// ) {
//   if (authMethod === "password" && (!email || !pass)) return null;

//   const cached = readCache(WISPR_CACHE_FILE);
//   if (cached && !isRefreshData) {
//     logger.debug("Wispr: loaded from file cache");
//     return cached;
//   }

//   logger.info("Initializing Wispr scraper...");

//   let browser;

//   // ── Browser launch ───────────────────────────────────────────────────────
//   if (authMethod === "google") {
//     if (!fs.existsSync(GOOGLE_PROFILE_DIR)) {
//       logger.error(
//         `Google session profile not found at ${GOOGLE_PROFILE_DIR}. ` +
//           `Run "node setup-google-session.js" once to create it.`
//       );
//       return readCache(WISPR_CACHE_FILE) || null;
//     }
//     browser = await puppeteer.launch({
//       ...getBrowserConfig(true),
//       userDataDir: GOOGLE_PROFILE_DIR,
//     });
//   } else {
//     // Both "password" and "cookies" use the standard config (no profile lock)
//     browser = await puppeteer.launch(getBrowserConfig(true));
//   }

//   const page = await browser.newPage();

//   const wisprData = {
//     as_of: new Date().toISOString().split("T")[0],
//     members: 0,
//     active_seats: 0,
//     billed_seats: 0,
//     words_dictated_all_time: 0,
//     words_delta_pct: 0.0,
//     words_delta_window: "prior 7 days",
//     users: [],
//   };

//   try {
//     // ── 1. LOGIN ────────────────────────────────────────────────────────────

//     if (authMethod === "cookies") {
//       // ── Cookie auth ──────────────────────────────────────────────────────
//       const cookies = loadCookies();

//       if (!cookies) {
//         throw new Error(
//           "No cookies found. Set the WISPR_COOKIES env var (run get-wispr-cookies.js " +
//             "locally to generate it) or place wispr-cookies.json in the project root."
//         );
//       }

//       logger.info(
//         "Injecting saved cookies and navigating directly to usage page..."
//       );

//       // Cookies must be set after visiting the domain first
//       await page.goto("https://admin.wisprflow.ai", {
//         waitUntil: "networkidle2",
//       });
//       await page.setCookie(...cookies);

//       await gotoWithOrgRetry(page, WISPR_URLS.usage);
//       await dumpDebugInfo(page, "c01-after-cookie-inject");

//       if (isAuthPage(page.url())) {
//         throw new Error(
//           "Cookies have expired — re-run get-wispr-cookies.js locally, " +
//             "then update the WISPR_COOKIES env var."
//         );
//       }

//       logger.info("Cookie session is valid, proceeding...");
//     } else if (authMethod === "google") {
//       // ── Google profile auth ──────────────────────────────────────────────
//       logger.info("Using persistent Google session — skipping login form...");
//       await gotoWithOrgRetry(page, WISPR_URLS.usage);
//       await dumpDebugInfo(page, "g01-direct-usage-attempt");

//       if (isAuthPage(page.url())) {
//         throw new Error(
//           "Google session has expired. Re-run setup-google-session.js manually."
//         );
//       }

//       logger.info("Existing Google session is valid, proceeding...");
//     } else {
//       // ── Password auth (original flow, unchanged) ─────────────────────────
//       logger.info("Navigating to login page...");
//       await page.goto(WISPR_URLS.login, { waitUntil: "networkidle2" });
//       await dumpDebugInfo(page, "01-login-page-initial");

//       try {
//         await page.waitForSelector(WISPR_SELECTORS.login.cookieAcceptButton, {
//           visible: true,
//           timeout: 5000,
//         });
//         logger.info("Cookie popup found, clicking accept...");
//         await page.click(WISPR_SELECTORS.login.cookieAcceptButton);
//         await new Promise((r) => setTimeout(r, 1000));
//       } catch {
//         logger.info("No cookie popup detected, proceeding...");
//       }

//       await page.waitForSelector(WISPR_SELECTORS.login.emailInput, {
//         visible: true,
//         timeout: 15000,
//       });

//       await page.type(WISPR_SELECTORS.login.emailInput, email, { delay: 30 });
//       await dumpDebugInfo(page, "02-after-email-typed");

//       const passwordFieldExists = await page
//         .$(WISPR_SELECTORS.login.passwordInput)
//         .then((el) => !!el);

//       if (!passwordFieldExists) {
//         logger.info(
//           "Password field not present — trying multi-step continue..."
//         );
//         await Promise.race([
//           page.click(WISPR_SELECTORS.login.continueButton).catch(() => null),
//           page.keyboard.press("Enter").catch(() => null),
//         ]);
//         await page
//           .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
//           .catch(() =>
//             logger.info("No navigation after continue (likely SPA)")
//           );
//         await new Promise((r) => setTimeout(r, 1500));
//         await dumpDebugInfo(page, "03-after-continue-click");
//         await page.waitForSelector(WISPR_SELECTORS.login.passwordInput, {
//           visible: true,
//           timeout: 15000,
//         });
//       }

//       await page.type(WISPR_SELECTORS.login.passwordInput, pass, { delay: 30 });
//       await dumpDebugInfo(page, "04-after-password-typed");

//       await Promise.all([
//         page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
//         page.click(WISPR_SELECTORS.login.submitButton),
//       ]);

//       const postLoginUrl = page.url();
//       logger.info(`Post-login URL: ${postLoginUrl}`);
//       await dumpDebugInfo(page, "05-post-login");

//       if (isAuthPage(postLoginUrl)) {
//         throw new Error(`Login failed — still on ${postLoginUrl}`);
//       }

//       await gotoWithOrgRetry(page, WISPR_URLS.usage);
//     }

//     // ── 2. USAGE DATA (shared by all auth methods) ──────────────────────────
//     await page.waitForSelector(WISPR_SELECTORS.usage.wordsDictated, {
//       visible: true,
//       timeout: 15000,
//     });
//     await dumpDebugInfo(page, "06-usage-page");

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
//       logger.warn(`Failed to extract words_dictated_all_time: ${err.message}`);
//     }

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
//       logger.warn(`Failed to extract words trend: ${err.message}`);
//     }

//     // ── 3. TEAM DATA ────────────────────────────────────────────────────────
//     logger.info("Extracting team seat metrics and user list...");
//     await gotoWithOrgRetry(page, WISPR_URLS.team);

//     await page.waitForSelector(WISPR_SELECTORS.team.summary, {
//       visible: true,
//       timeout: 15000,
//     });
//     await dumpDebugInfo(page, "07-team-page");

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
//       logger.warn(`Failed to extract team summary: ${err.message}`);
//     }

//     try {
//       await page.waitForSelector('[class*="_userRow_"]', { timeout: 8000 });

//       const users = await page.evaluate(() => {
//         const rows = document.querySelectorAll('[class*="_userRow_"]');
//         return Array.from(rows).map((row) => {
//           const avatarImg = row.querySelector('[class*="_profile_"] img');
//           const image_url = avatarImg ? avatarImg.getAttribute("src") : "";

//           const nameEl = row.querySelector('[class*="_name_"]');
//           let name = "";
//           if (nameEl) {
//             const clone = nameEl.cloneNode(true);
//             clone
//               .querySelectorAll('[class*="_selfTag_"]')
//               .forEach((t) => t.remove());
//             name = clone.textContent.trim();
//           }

//           const emailEl = row.querySelector('[class*="_email_"]');
//           const email = emailEl ? emailEl.textContent.trim() : "";

//           const trialStatusEl = row.querySelector(
//             '[class*="_trialStatusText_"]'
//           );
//           let status = "active";
//           if (trialStatusEl) {
//             const t = trialStatusEl.textContent.trim().toLowerCase();
//             status = t.includes("trial") ? "trialing" : t || "active";
//           } else {
//             const roleEl = row.querySelector('[class*="_role_"]');
//             if (roleEl?.textContent.trim().toLowerCase() === "pending")
//               status = "pending";
//           }

//           const selectMainTextEl = row.querySelector(
//             '[class*="_selectMainText_"]'
//           );
//           let role = selectMainTextEl
//             ? selectMainTextEl.textContent.trim()
//             : row.querySelector('[class*="_role_"]')?.textContent.trim() || "";

//           return { image_url, name, email, status, role };
//         });
//       });

//       wisprData.users = users;
//       logger.info(`Extracted ${users.length} user(s) from team table`);
//     } catch (userErr) {
//       logger.warn(`Failed to extract user table: ${userErr.message}`);
//       wisprData.users = [];
//     }

//     let bucketCounts = [];
//     let bucketLabels = [];
//     try {
//       bucketCounts = await page.$$eval(
//         WISPR_SELECTORS.team.bucketCount,
//         (els) => els.map((el) => el.innerText.trim())
//       );
//     } catch (err) {
//       logger.warn(`Failed to extract bucket counts: ${err.message}`);
//     }
//     try {
//       bucketLabels = await page.$$eval(
//         WISPR_SELECTORS.team.bucketLabel,
//         (els) => els.map((el) => el.innerText.trim())
//       );
//     } catch (err) {
//       logger.warn(`Failed to extract bucket labels: ${err.message}`);
//     }

//     const buckets = {};
//     bucketLabels.forEach((label, i) => {
//       buckets[label] =
//         parseInt((bucketCounts[i] || "0").replace(/,/g, ""), 10) || 0;
//     });
//     logger.info(`Team seat buckets: ${JSON.stringify(buckets)}`);
//     wisprData.active_seats = buckets["Paid seats"] ?? 0;

//     logger.info("Scraping completed successfully.");
//     logger.info(
//       `Final scraped data: ${JSON.stringify(wisprData?.users.length)}`
//     );

//     try {
//       if (!fs.existsSync(CACHE_DIR))
//         fs.mkdirSync(CACHE_DIR, { recursive: true });
//       writeCache(WISPR_CACHE_FILE, wisprData);
//       logger.info(`Cached to ${path.join(CACHE_DIR, WISPR_CACHE_FILE)}`);
//     } catch (cacheWriteError) {
//       logger.error(`Failed to write cache: ${cacheWriteError.message}`);
//     }

//     return wisprData;
//   } catch (error) {
//     logger.error(`Scraper failed:`, {
//       status: error?.response?.status || error?.status,
//       message: error.message,
//       stack: error.stack,
//     });
//     await dumpDebugInfo(page, "99-failure-state");

//     if (error.message?.includes("couldn't load organization")) {
//       logger.error(
//         "Wispr app failed to load org repeatedly — transient error on their side."
//       );
//     }

//     try {
//       const cached = readCache(WISPR_CACHE_FILE);
//       if (cached) {
//         logger.info("Returning last cached data after scrape failure.");
//         return cached;
//       }
//     } catch (cacheReadError) {
//       logger.error(`Cache fallback failed: ${cacheReadError.message}`);
//     }

//     return null;
//   } finally {
//     await browser.close();
//   }
// }

export { scrapeWisprData };
