import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "../../", ".cache");
const CACHE_TTL_MS = 12 * 24 * 60 * 60 * 1000; // 59 minutes
// const CACHE_TTL_MS = 59 * 60 * 1000; // 59 minutes
import { logger } from "../index.js";

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readCache(filename) {
  try {
    const filePath = path.join(CACHE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;

    const { savedAt, data } = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const ageMs = Date.now() - new Date(savedAt).getTime();

    if (ageMs > CACHE_TTL_MS) {
      logger.debug(
        `Cache stale (${Math.round(ageMs / 1000)}s old): ${filename}`
      );
      return null;
    }

    logger.debug(`Cache hit (${Math.round(ageMs / 1000)}s old): ${filename}`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Writes data wrapped in a { savedAt, data } envelope so TTL can be checked on read.
 */
function writeCache(filename, data) {
  try {
    ensureCacheDir();
    const envelope = { savedAt: new Date().toISOString(), data };
    fs.writeFileSync(
      path.join(CACHE_DIR, filename),
      JSON.stringify(envelope, null, 2),
      "utf8"
    );
    logger.info(`Cached scraped data to ${path.join(CACHE_DIR, filename)}`);
  } catch (err) {
    logger.error(`Cache write failed for ${filename}: ${err.message}`);
  }
}

export { readCache, writeCache };
