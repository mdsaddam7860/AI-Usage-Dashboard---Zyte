import puppeteer from "puppeteer";
import fs from "fs";
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
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  } else if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else {
    return "/usr/bin/google-chrome";
  }
}

(async () => {
  console.log("Launching Chrome — please log in manually...\n");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: getRealChromePath(),
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await page.goto(WISPR_LOGIN_URL, { waitUntil: "networkidle2" });

  console.log("=========================================================");
  console.log("1. Click 'Continue with Google' and sign in");
  console.log("2. Once you see the Wispr dashboard, come back here");
  console.log("3. Press ENTER to export your cookies");
  console.log("=========================================================\n");

  // Wait for user to press Enter
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  // Export cookies
  const cookies = await page.cookies();
  const cookieString = JSON.stringify(cookies);
  const base64Cookies = Buffer.from(cookieString).toString("base64");

  console.log("\n✅ Done! Copy the line below into your .env file:\n");
  console.log("─".repeat(60));
  console.log(`WISPR_COOKIES=${base64Cookies}`);
  console.log("─".repeat(60));

  // Also save to file as backup
  fs.writeFileSync("wispr-cookies.json", JSON.stringify(cookies, null, 2));
  console.log("\n📁 Also saved raw cookies to wispr-cookies.json (backup)");

  await browser.close();
  process.exit(0);
})();
