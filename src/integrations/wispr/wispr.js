import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { readCache, writeCache } from "../../utils/helper.js";
import { logger } from "../../index.js";
import { wisprExecutor } from "../../utils/executors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WISPR_API_BASE = "https://api.wisprflow.ai/api/v1/enterprise";
const ENTERPRISE_ID = "9d654dae-7a63-41a6-865c-e8a7f632ea4c";
const WISPR_CACHE_FILE = "wispr_data.json";
const WISPR_MEMBERS_CACHE_FILE = "wispr-members.json";
const WISPR_USAGE_CACHE_FILE = "wispr-usage.json";
const WISPR_HISTORY_CACHE_FILE = "wispr-history.json";

// API client setup
function createApiClient(authToken) {
  return axios.create({
    baseURL: WISPR_API_BASE,
    headers: {
      Authorization: authToken,
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

// Fetch words dictated data
async function fetchWordsDictated(apiClient) {
  try {
    const response = await wisprExecutor(
      () => {
        return apiClient.get("/insights/words-dictated", {
          params: {
            enterprise_id: ENTERPRISE_ID,
          },
        });
      },
      { name: `fetchWordsDictated` }
    );

    logger.info("Successfully fetched words dictated data");
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch words dictated:", {
      status: error?.response?.status || error?.status,
      message: error.message,
      response: error?.response?.data,
      stack: error.stack,
    });
    throw error;
  }
}

// Fetch team members
async function fetchTeamMembers(apiClient) {
  try {
    const response = await wisprExecutor(
      () => {
        return apiClient.get("/members");
      },
      { name: `fetchTeamMembers` }
    );

    logger.info(
      `Successfully fetched ${response.data.members?.length || 0} team members`
    );
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch team members:", {
      status: error?.response?.status || error?.status,
      message: error.message,
      response: error?.response?.data,
      stack: error.stack,
    });
    throw error;
  }
}

// Calculate member statistics
function calculateMemberStats(members) {
  const stats = {
    total: members.length,
    active: 0,
    trialing: 0,
    pending: 0,
  };

  members.forEach((member) => {
    const now = Math.floor(Date.now() / 1000);

    if (member.teamTrialGiven && member.trialEndsAt > now) {
      stats.trialing++;
    } else if (member.role === "pending") {
      stats.pending++;
    } else {
      stats.active++;
    }
  });

  return stats;
}

// Extract usage data similar to scraper response
function extractUsageData(wordsData) {
  const data = wordsData.data || wordsData;

  return {
    words_dictated_all_time: data.total || 0,
    words_delta_pct: data.pct_change_vs_prev_period || 0,
    words_delta_window: data.comparisonPeriod || "prior 7 days",
    trialEndsAt: data.trialEndsAt,
    gracePeriodEndsAt: data.gracePeriodEndsAt,
    daily: data.timeseries.daily || [],
    weekly: data.timeseries.weekly || [],
  };
}

// Transform API member to match scraper format
function transformMember(apiMember) {
  const now = Math.floor(Date.now() / 1000);
  let status = "active";

  if (apiMember.teamTrialGiven && apiMember.trialEndsAt > now) {
    status = "trialing";
  } else if (apiMember.role === "pending") {
    status = "pending";
  }

  return {
    image_url: apiMember.avatarUrl || "",
    name: `${apiMember.firstName || ""} ${apiMember.lastName || ""}`.trim(),
    email: apiMember.email || "",
    status: status,
    role: apiMember.role || "member",
  };
}

// Store usage history for trend analysis
function storeUsageHistory(usageData, memberStats) {
  try {
    let history = readCache(WISPR_HISTORY_CACHE_FILE) || [];

    const record = {
      as_of: new Date().toISOString().split("T")[0],
      words_dictated_all_time: usageData.words_dictated_all_time,
      words_delta_pct: usageData.words_delta_pct,
      words_delta_window: usageData.words_delta_window,
      members_count: memberStats.total,
      active_seats: memberStats.active,
      billed_seats: memberStats.total,
    };

    // Add new record and keep last 365 days
    history.push(record);
    if (history.length > 365) {
      history = history.slice(-365);
    }

    writeCache(WISPR_HISTORY_CACHE_FILE, history);
    logger.info(`Stored usage history (${history.length} records)`);
  } catch (error) {
    logger.error(`Failed to store usage history: `, {
      status: error?.response?.status || error?.status,
      message: error.message,
      response: error?.response?.data,
      stack: error.stack,
    });
  }
}

// Main function that mimics the original scraper interface
async function fetchWisprData(
  authToken,
  isRefreshData = false,
  useCache = true
) {
  if (!authToken) {
    logger.error("Authorization token is required");
    return null;
  }

  // Check cache first if not refreshing
  if (useCache && !isRefreshData) {
    const cached = readCache(WISPR_CACHE_FILE);
    if (cached) {
      logger.debug("Wispr: loaded from file cache");
      return cached;
    }
  }

  logger.info("Initializing Wispr API fetch...");

  const apiClient = createApiClient(authToken);

  // Initialize the response object matching scraper format
  const wisprData = {
    as_of: new Date().toISOString().split("T")[0],
    members: 0,
    active_seats: 0,
    billed_seats: 0,
    words_dictated_all_time: 0,
    words_delta_pct: 0.0,
    words_delta_window: "prior 7 days",
    daily: [],
    weekly: [],
    users: [],
  };

  try {
    // Fetch both endpoints in parallel for efficiency
    const [wordsResponse, membersResponse] = await Promise.all([
      fetchWordsDictated(apiClient),
      fetchTeamMembers(apiClient),
    ]);

    // Extract and transform data
    const usageData = extractUsageData(wordsResponse);
    const members = membersResponse.members || [];
    const memberStats = calculateMemberStats(members);

    // Update response object
    wisprData.words_dictated_all_time = usageData.words_dictated_all_time;
    wisprData.words_delta_pct = usageData.words_delta_pct;
    wisprData.words_delta_window = usageData.words_delta_window;
    wisprData.daily = usageData.daily;
    wisprData.weekly = usageData.weekly;
    wisprData.members = memberStats.total;
    wisprData.active_seats = memberStats.active;
    wisprData.billed_seats = memberStats.total;
    wisprData.users = members.map(transformMember);

    // Store in separate cache files for modular access
    writeCache(WISPR_CACHE_FILE, wisprData);
    // writeCache(WISPR_USAGE_CACHE_FILE, usageData);
    // writeCache(WISPR_MEMBERS_CACHE_FILE, members.map(transformMember));

    // Store usage history for trends
    // storeUsageHistory(usageData, memberStats);

    // logger.info(
    //   `Successfully fetched Wispr data: ${JSON.stringify(wisprData, null, 2)}`
    // );

    return wisprData;
  } catch (error) {
    logger.error("Failed to fetch Wispr data:", {
      status: error?.response?.status || error?.status,
      message: error.message,
      response: error?.response?.data,
      stack: error.stack,
    });

    // Try to get last cached data as fallback
    const cached = readCache(WISPR_CACHE_FILE);
    if (cached) {
      logger.info("Returning last cached data after fetch failure");
      return cached;
    }

    return null;
  }
}

// Helper function to get only usage stats
async function getWisprUsageStats(authToken, isRefreshData = false) {
  const cached = readCache(WISPR_USAGE_CACHE_FILE);
  if (cached && !isRefreshData) {
    return cached;
  }

  const fullData = await fetchWisprData(authToken, isRefreshData);
  if (fullData) {
    return {
      words_dictated_all_time: fullData.words_dictated_all_time,
      words_delta_pct: fullData.words_delta_pct,
      words_delta_window: fullData.words_delta_window,
    };
  }
  return null;
}

// Helper function to get only team members
async function getWisprTeamMembers(authToken, isRefreshData = false) {
  const cached = readCache(WISPR_MEMBERS_CACHE_FILE);
  if (cached && !isRefreshData) {
    return cached;
  }

  const fullData = await fetchWisprData(authToken, isRefreshData);
  return fullData?.users || [];
}

// Get usage history for trend analysis
function getUsageHistory() {
  return readCache(WISPR_HISTORY_CACHE_FILE) || [];
}

// Get members filtered by status
function getMembersByStatus(status = null) {
  const members = readCache(WISPR_MEMBERS_CACHE_FILE) || [];

  if (!status) return members;

  return members.filter((member) => member.status === status);
}

// Export functions
export {
  fetchWisprData,
  getWisprUsageStats,
  getWisprTeamMembers,
  getUsageHistory,
  getMembersByStatus,
};
