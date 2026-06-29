// ============================================================
// RUN THIS ONCE, MANUALLY, TO ESTABLISH A GOOGLE-AUTHENTICATED SESSION
// ============================================================
// Why this exists: Google blocks automated sign-in attempts on
// accounts.google.com (you just hit this — "Couldn't sign you in,
// this browser or app may not be secure"). Stealth plugins and
// selector fixes can't reliably get around this; Google is actively
// fingerprinting CDP-controlled Chrome on that specific page.
//
// The fix: log in as a HUMAN, once, in a real visible browser window
// that Puppeteer launches with a PERSISTENT profile (userDataDir).
// Because a human completed the login, Google has no reason to block
// it. The cookies/local storage from that login are saved to disk in
// the profile folder. Your scraper then launches Chrome pointed at
// THE SAME profile folder and is already authenticated — it never
// touches Google's login form again.
//
// USAGE:
//   node setup-google-session.js
//   -> A real Chrome window opens.
//   -> Manually click "Continue with Google" and log in as you
//      normally would (password, 2FA, whatever your account needs).
//   -> Once you see the Wispr dashboard, come back to this terminal
//      and press Ctrl+C to close.
//
// Re-run this only when the session eventually expires (Google
// sessions can last weeks/months, but will eventually need a refresh).
// ============================================================

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { WISPR_SELECTORS, WISPR_URLS } from "./selectors.js";
import { getBrowserConfig } from "../../configs/browserConfig.js";
import { logger } from "../../index.js";
import { readCache, writeCache } from "../../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Cache helpers (these are not used in setup, but kept for consistency)
const CACHE_DIR = path.resolve(".cache");
const WISPR_CACHE_FILE = "wispr_data.json";

const DEBUG_DIR = "./debug-output";
const USER_DATA_DIR = path.join(__dirname, "google-session-profile");
const WISPR_LOGIN_URL = "https://admin.wisprflow.ai/login";

(async () => {
  console.log(`Using profile directory: ${USER_DATA_DIR}`);
  console.log("Launching a real, visible Chrome window...");

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.goto(WISPR_LOGIN_URL, { waitUntil: "networkidle2" });

  console.log("\n=========================================================");
  console.log("Log in manually now (click 'Continue with Google', enter");
  console.log("your credentials / 2FA as needed). Once you land on the");
  console.log("Wispr dashboard, come back here and press Ctrl+C to exit.");
  console.log("=========================================================\n");

  // Keep the process (and browser) alive until the user Ctrl+C's out.
  await new Promise(() => {});
})();

/*The Real Fix: Use Your System Chrome (Not Puppeteer's Chromium)

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, "google-session-profile");
const WISPR_LOGIN_URL = "https://admin.wisprflow.ai/login";

function getRealChromePath() {
  const platform = process.platform;
  if (platform === "win32") {
    // Adjust if Chrome is installed in a different location
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  } else if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else {
    return "/usr/bin/google-chrome";
  }
}

(async () => {
  console.log(`Using profile directory: ${USER_DATA_DIR}`);
  console.log("Launching real Chrome (not Chromium)...");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: getRealChromePath(),       // ← KEY: real Chrome, not Chromium
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled", // ← hides automation flag
    ],
    ignoreDefaultArgs: ["--enable-automation"],        // ← removes "controlled" banner
  });

  const page = await browser.newPage();

  // Patch out the webdriver property before any page loads
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  await page.goto(WISPR_LOGIN_URL, { waitUntil: "networkidle2" });

  console.log("\n=========================================================");
  console.log("Log in manually now — click 'Continue with Google' and");
  console.log("complete sign-in. Once on the Wispr dashboard, Ctrl+C.");
  console.log("=========================================================\n");

  await new Promise(() => {});
})();

*/
