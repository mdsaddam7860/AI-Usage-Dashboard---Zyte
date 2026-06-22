import { logger } from "../index.js";
import axios from "axios";
import { apiExecutor } from "../utils/executors.js";
// ── Environment Variables Fallback ─────────────────────
// The server will use .env variables if present, or headers if passed from the client

// ── Claude Real-Time Fetch Logic ───────────────────────
// async function fetchClaudeData(apiKey) {
//   if (!apiKey) return { claude: [], claude_seats: [] };

//   const seats = [];
//   const rows = [];
//   const fallbackDate = new Date().toISOString();

//   let page = null;
//   const headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };

//   try {
//     do {
//       const url = new URL(
//         "https://api.anthropic.com/v1/organizations/spend_limits/effective"
//       );
//       url.searchParams.append("limit", "100");
//       if (page) url.searchParams.append("page", page);

//       const r = await fetch(url, { headers });
//       if (!r.ok) {
//         logger.error(`Claude Spend API Error: ${r.status}`);
//         break;
//       }

//       const j = await r.json();
//       for (const item of j.data || []) {
//         const actor = item.actor || {};
//         const scope = item.scope || {};

//         const userName = actor.name || "Unknown User";
//         const email = actor.email_address || "";
//         const userId = scope.user_id || actor.user_id || "unknown";

//         // Anthropic stores amounts in cents
//         const limitUsd = parseFloat(item.amount || 0) / 100.0;
//         const spendUsd = parseFloat(item.period_to_date_spend || 0) / 100.0;
//         const remainingUsd = Math.max(0, limitUsd - spendUsd);

//         seats.push({
//           user: userName,
//           email: email,
//           user_id: userId,
//           limit_usd: limitUsd,
//           spend_usd: spendUsd,
//           remaining_usd: remainingUsd,
//           period: item.period || "monthly",
//         });

//         // Synthesize token metrics for the charts based on spend
//         if (spendUsd > 0) {
//           const estTotalTokens = Math.floor(spendUsd * 333333);
//           rows.push({
//             date: fallbackDate,
//             user: userName,
//             team: "Engineering", // Default fallback
//             api_key: "managed_seat",
//             workspace: "Default",
//             model: "claude-3.5-sonnet",
//             input_tokens: Math.floor(estTotalTokens * 0.8),
//             output_tokens: Math.floor(estTotalTokens * 0.2),
//             total_tokens: estTotalTokens,
//             cost_usd: spendUsd,
//           });
//         }
//       }
//       page = j.next_page;
//     } while (page);
//   } catch (error) {
//     logger.error("Failed to fetch Claude data:", {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       message: error.message,
//     });
//   }

//   return { claude: rows, claude_seats: seats };
// }

// // ── GitHub Copilot Real-Time Fetch Logic ───────────────
// async function fetchCopilotData(token, org) {
//   if (!token || !org) return { copilot: [], copilot_seats: [] };

//   const headers = {
//     Authorization: `Bearer ${token}`,
//     Accept: "application/vnd.github+json",
//     "X-GitHub-Api-Version": "2022-11-28",
//   };

//   const seats = [];
//   let rows = [];
//   const fallbackDate = new Date().toISOString();

//   // 1. Fetch Seats
//   try {
//     let page = 1;
//     let hasMore = true;

//     while (hasMore) {
//       const seatsRes = await fetch(
//         `https://api.github.com/orgs/${org}/copilot/billing/seats?per_page=100&page=${page}`,
//         { headers }
//       );
//       if (!seatsRes.ok) break;

//       const seatsData = await seatsRes.json();
//       const batch = seatsData.seats || [];
//       if (batch.length < 100) hasMore = false;
//       page++;

//       // Fetch AI credits for this batch concurrently
//       await Promise.all(
//         batch.map(async (s) => {
//           const username = (s.assignee && s.assignee.login) || "unknown";
//           const teamName =
//             (s.assigning_team && s.assigning_team.name) || "direct";

//           let creditsSpent = 0.0;
//           try {
//             const creditRes = await fetch(
//               `https://api.github.com/orgs/${org}/settings/billing/ai_credit/usage?user=${username}`,
//               { headers }
//             );
//             if (creditRes.ok) {
//               const creditData = await creditRes.json();
//               creditsSpent = (creditData.usageItems || []).reduce(
//                 (sum, item) => sum + (item.grossQuantity || 0),
//                 0
//               );
//             }
//           } catch (e) {
//             logger.error(`Credit fetch failed for ${username}`, {
//               status: error?.status,
//               response: error.response?.data,
//               method: error?.method,
//               url: error?.config?.url,
//               headers: error?.config?.headers,
//               message: error.message,
//             });
//           }

//           const budgetLimit = 20.0;
//           seats.push({
//             user: username,
//             team: teamName,
//             last_activity: (s.last_activity_at || "").substring(0, 10),
//             last_editor: s.last_activity_editor || "",
//             plan: s.plan_type || "business",
//             limit_usd: budgetLimit,
//             spend_usd: creditsSpent,
//             remaining_usd: Math.max(0, budgetLimit - creditsSpent),
//           });

//           // Synthesize fallback chart metrics if the user spent credits
//           if (creditsSpent > 0) {
//             const estSuggestions = Math.floor(creditsSpent * 500);
//             const estAcceptances = Math.floor(estSuggestions * 0.3);
//             const estTotalTokens = Math.floor(creditsSpent * 250000);

//             rows.push({
//               date: fallbackDate,
//               user: username,
//               team: teamName,
//               editor: s.last_activity_editor || "vscode",
//               language: "python",
//               model: "copilot-ai-credits",
//               suggestions: estSuggestions,
//               acceptances: estAcceptances,
//               lines_suggested: estSuggestions * 3,
//               lines_accepted: estAcceptances * 2,
//               chats: Math.floor(creditsSpent * 10),
//               engaged: 1,
//               input_tokens: Math.floor(estTotalTokens * 0.8),
//               output_tokens: Math.floor(estTotalTokens * 0.2),
//               total_tokens: estTotalTokens,
//               cost_usd: creditsSpent,
//             });
//           }
//         })
//       );
//     }
//   } catch (error) {
//     logger.error("Failed to fetch Copilot seats:", {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       message: error.message,
//     });
//   }

//   // 2. Fetch & Parse NDJSON Reports
//   try {
//     const repRes = await fetch(
//       `https://api.github.com/orgs/${org}/copilot/metrics/reports/users-28-day/latest`,
//       { headers }
//     );
//     if (repRes.ok) {
//       const repData = await repRes.json();
//       const links = repData.download_links || [];
//       const parsedRows = [];

//       for (const link of links) {
//         const dlRes = await fetch(link);
//         const text = await dlRes.text();
//         const lines = text.split("\n").filter((line) => line.trim() !== "");

//         for (const line of lines) {
//           const record = JSON.parse(line);
//           const date = record.day_partition || "unknown-date";
//           const username = record.user_login || "unknown-user";
//           const chats = record.user_initiated_interaction_count || 0;
//           const models = record.totals_by_language_model || [];

//           if (models.length === 0) {
//             if (chats > 0 || record.used_chat) {
//               parsedRows.push({
//                 date,
//                 user: username,
//                 team: "direct",
//                 editor: "unknown",
//                 language: "unknown",
//                 model: "unknown",
//                 suggestions: 0,
//                 acceptances: 0,
//                 lines_suggested: 0,
//                 lines_accepted: 0,
//                 chats,
//                 engaged: 1,
//               });
//             }
//             continue;
//           }

//           for (const interaction of models) {
//             parsedRows.push({
//               date,
//               user: username,
//               team: "direct",
//               editor: interaction.editor || "unknown",
//               language: interaction.language || "unknown",
//               model: interaction.model || "unknown",
//               suggestions: interaction.suggestions_count || 0,
//               acceptances: interaction.acceptances_count || 0,
//               lines_suggested: interaction.lines_suggested || 0,
//               lines_accepted: interaction.lines_accepted || 0,
//               chats: chats,
//               engaged: interaction.acceptances_count > 0 ? 1 : 0,
//             });
//           }
//         }
//       }

//       // If we successfully parsed the NDJSON report, overwrite the synthetic rows
//       if (parsedRows.length > 0) rows = parsedRows;
//     }
//   } catch (error) {
//     logger.error("Failed to fetch/parse NDJSON reports:", {
//       status: error?.status,
//       response: error.response?.data,
//       method: error?.method,
//       url: error?.config?.url,
//       headers: error?.config?.headers,
//       message: error.message,
//     });
//   }

//   return { copilot: rows, copilot_seats: seats };
// }
import fs from "fs";
import path from "path";

// ── Cache helpers ──────────────────────────────────────
const CACHE_DIR = path.resolve(".cache");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// const CACHE_TTL_MS = 1000; // 5 minutes
const CACHE_TTL_MS = 24 * 600 * 60 * 60 * 1000; // 5 minutes

/**
 * Returns cached data if it exists and is younger than CACHE_TTL_MS.
 * Returns null if the file is missing, unreadable, or stale.
 */
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
    logger.debug(`Cache written: ${filename}`);
  } catch (err) {
    logger.error(`Cache write failed for ${filename}:`, {
      message: err.message,
    });
  }
}

// ── Claude Real-Time Fetch Logic ───────────────────────
const CLAUDE_CACHE_FILE = "claude_data.json";
const ESTIMATION_CONFIG = {
  tokensPerUsd: 333333,
  inputRatio: 0.8,
  outputRatio: 0.2,
  defaultTeam: "Unknown",
  defaultApiKey: "estimated",
  defaultWorkspace: "estimated",
  defaultModel: "estimated",
};
async function fetchClaudeData(apiKey) {
  if (!apiKey) return { claude: [], claude_seats: [] };

  // 1. Try file cache first
  const cached = readCache(CLAUDE_CACHE_FILE);
  if (cached) {
    logger.debug("Claude: loaded from file cache");
    return cached;
  }

  const seats = [];
  const rows = [];
  const fallbackDate = new Date().toISOString();

  let page = null;
  const headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };

  try {
    do {
      const params = { limit: 100 };
      if (page) params.page = page;

      const r = await apiExecutor(() =>
        axios({
          method: "GET",
          url: "https://api.anthropic.com/v1/organizations/spend_limits/effective",
          headers,
          params,
        })
      );

      const j = r.data;

      for (const item of j.data || []) {
        const actor = item.actor || {};
        const scope = item.scope || {};

        const userName = actor.name || "Unknown User";
        const email = actor.email_address || "";
        const userId = scope.user_id || actor.user_id || "unknown";

        const limitUsd = parseFloat(item.amount || 0) / 100.0;
        const spendUsd = parseFloat(item.period_to_date_spend || 0) / 100.0;
        const remainingUsd = Math.max(0, limitUsd - spendUsd);

        seats.push({
          user: userName,
          email,
          user_id: userId,
          limit_usd: limitUsd,
          spend_usd: spendUsd,
          remaining_usd: remainingUsd,
          period: item.period || "monthly",
        });

        if (spendUsd > 0) {
          const estTotalTokens = Math.floor(
            spendUsd * ESTIMATION_CONFIG.tokensPerUsd
          );

          rows.push({
            date: fallbackDate,
            user: userName,
            team: ESTIMATION_CONFIG.defaultTeam,
            api_key: ESTIMATION_CONFIG.defaultApiKey,
            workspace: ESTIMATION_CONFIG.defaultWorkspace,
            model: ESTIMATION_CONFIG.defaultModel,
            input_tokens: Math.floor(
              estTotalTokens * ESTIMATION_CONFIG.inputRatio
            ),
            output_tokens: Math.floor(
              estTotalTokens * ESTIMATION_CONFIG.outputRatio
            ),
            total_tokens: estTotalTokens,
            cost_usd: spendUsd,
            estimated: true,
          });
        }
      }
      page = j.next_page;
    } while (page);
  } catch (error) {
    logger.error("Failed to fetch Claude data:", {
      status: error?.response?.status || error?.status,
      message: error.message,
    });
  }

  logger.debug(`Claude : ${JSON.stringify(rows, null, 2)}`);
  logger.debug(`Claude seats : ${JSON.stringify(seats, null, 2)}`);

  const result = { claude: rows, claude_seats: seats };

  // 2. Persist to file cache
  writeCache(CLAUDE_CACHE_FILE, result);

  return result;
}

// ── GitHub Copilot Real-Time Fetch Logic ───────────────
const COPILOT_CACHE_FILE = "copilot_data.json";

/*

async function fetchCopilotData(token, org) {
  if (!token || !org) return { copilot: [], copilot_seats: [] };

  // 1. Try file cache first
  const cached = readCache(COPILOT_CACHE_FILE);
  if (cached) {
    logger.debug("Copilot: loaded from file cache");
    return cached;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const seats = [];
  let rows = [];
  const fallbackDate = new Date().toISOString();

  // 2. Fetch Seats
  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const seatsRes = await apiExecutor(() =>
          axios({
            method: "GET",
            url: `https://api.github.com/orgs/${org}/copilot/billing/seats`,
            headers,
            params: { per_page: 100, page },
          })
        );

        const seatsData = seatsRes.data;
        const batch = seatsData.seats || [];
        if (batch.length < 100) hasMore = false;
        page++;

        await Promise.all(
          batch.map(async (s) => {
            const username = (s.assignee && s.assignee.login) || "unknown";
            const teamName =
              (s.assigning_team && s.assigning_team.name) || "direct";

            let creditsSpent = 0.0;
            let creditData = { usageItems: [] }; // Declare outside with default
            try {
              const creditRes = await apiExecutor(() =>
                axios({
                  method: "GET",
                  url: `https://api.github.com/orgs/${org}/settings/billing/ai_credit/usage`,
                  headers,
                  params: { user: username },
                })
              );

              creditData = creditRes.data;
              creditsSpent = (creditData.usageItems || []).reduce(
                (sum, item) => sum + (item.grossQuantity || 0),
                0
              );
            } catch (error) {
              logger.error(`Credit fetch failed for ${username}`, {
                message: error.message,
              });
            }

            const budgetLimit = 20.0;
            // Then aggregate correctly:
            const grossCredits = creditData.usageItems.reduce(
              (s, i) => s + i.grossQuantity,
              0
            ); // 360.15 credits
            const netCredits = creditData.usageItems.reduce(
              (s, i) => s + i.netQuantity,
              0
            ); // 176 credits
            const grossAmount = creditData.usageItems.reduce(
              (s, i) => s + i.grossAmount,
              0
            ); // $3.60
            const netAmount = creditData.usageItems.reduce(
              (s, i) => s + i.netAmount,
              0
            ); // $1.76 (actually billed)
            seats.push({
              user: username,
              team: teamName,
              pricePerUnit: 0.01,
              last_activity: (s.last_activity_at || "").substring(0, 10),
              last_editor: s.last_activity_editor || "",
              plan: s.plan_type || "business",
              limit_usd: budgetLimit,
              spend_usd: creditsSpent,
              remaining_usd: Math.max(0, budgetLimit - creditsSpent),

              grossCredits: grossCredits.toFixed(2),
              grossAmount: grossAmount.toFixed(2),
              netCredits: netCredits.toFixed(2),
              netAmount: netAmount.toFixed(2),
              amountSaved: (grossAmount - netAmount).toFixed(2),
            });

            if (creditsSpent > 0) {
              const estSuggestions = Math.floor(creditsSpent * 500);
              const estAcceptances = Math.floor(estSuggestions * 0.3);
              const estTotalTokens = Math.floor(creditsSpent * 250000);

              rows.push({
                date: fallbackDate,
                user: username,
                team: teamName,
                editor: s.last_activity_editor || "vscode",
                language: "python",
                model: "copilot-ai-credits",
                suggestions: estSuggestions,
                acceptances: estAcceptances,
                lines_suggested: estSuggestions * 3,
                lines_accepted: estAcceptances * 2,
                chats: Math.floor(creditsSpent * 10),
                engaged: 1,
                input_tokens: Math.floor(estTotalTokens * 0.8),
                output_tokens: Math.floor(estTotalTokens * 0.2),
                total_tokens: estTotalTokens,
                cost_usd: creditsSpent,
              });
            }
          })
        );
      } catch (err) {
        hasMore = false;
        throw err;
      }
    }
  } catch (error) {
    logger.error("Failed to fetch Copilot seats:", { message: error.message });
  }

  // 3. Fetch & Parse NDJSON Reports
  try {
    const repRes = await apiExecutor(() =>
      axios({
        method: "GET",
        url: `https://api.github.com/orgs/${org}/copilot/metrics/reports/users-28-day/latest`,
        headers,
      })
    );

    const repData = repRes.data;
    const links = repData.download_links || [];
    const parsedRows = [];

    for (const link of links) {
      const dlRes = await apiExecutor(() =>
        axios({ method: "GET", url: link, responseType: "text" })
      );

      const text = dlRes.data;
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        const record = JSON.parse(line);
        const date = record.day_partition || "unknown-date";
        const username = record.user_login || "unknown-user";
        const chats = record.user_initiated_interaction_count || 0;
        const models = record.totals_by_language_model || [];

        if (models.length === 0) {
          if (chats > 0 || record.used_chat) {
            parsedRows.push({
              date,
              user: username,
              team: "direct",
              editor: "unknown",
              language: "unknown",
              model: "unknown",
              suggestions: 0,
              acceptances: 0,
              lines_suggested: 0,
              lines_accepted: 0,
              chats,
              engaged: 1,
            });
          }
          continue;
        }

        for (const interaction of models) {
          parsedRows.push({
            date,
            user: username,
            team: "direct",
            editor: interaction.editor || "unknown",
            language: interaction.language || "unknown",
            model: interaction.model || "unknown",
            suggestions: interaction.suggestions_count || 0,
            acceptances: interaction.acceptances_count || 0,
            lines_suggested: interaction.lines_suggested || 0,
            lines_accepted: interaction.lines_accepted || 0,
            chats,
            engaged: interaction.acceptances_count > 0 ? 1 : 0,
          });
        }
      }
    }

    if (parsedRows.length > 0) rows = parsedRows;
  } catch (error) {
    logger.error("Failed to fetch/parse NDJSON reports:", {
      message: error.message,
    });
  }

  logger.debug(`Copilot : ${JSON.stringify(rows, null, 2)}`);
  logger.debug(`Copilot Seats : ${JSON.stringify(seats, null, 2)}`);

  const result = { copilot: rows, copilot_seats: seats };

  // 4. Persist to file cache
  writeCache(COPILOT_CACHE_FILE, result);

  return result;
}
*/

async function fetchCopilotData(token, org) {
  if (!token || !org)
    return { copilot: [], copilot_seats: [], org_ai_credits: null };

  // 1. Try file cache first
  const cached = readCache(COPILOT_CACHE_FILE);
  if (cached) {
    logger.debug("Copilot: loaded from file cache");
    return cached;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // ─── Fetch org-level budgets ──────────────────────────────────────────────
  // zytedata has no per-user budgets — only an org-wide $5,000 ai_credits pool.
  // We store that pool amount and return it alongside seat data so the UI can
  // show org-level utilisation without fabricating a per-user limit.
  let orgAiCreditBudgetUsd = null;
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const budgetRes = await apiExecutor(() =>
        axios({
          method: "GET",
          url: `https://api.github.com/organizations/${org}/settings/billing/budgets`,
          headers,
          params: { per_page: 100, page },
        })
      );
      const budgets = budgetRes.data.budgets || [];
      if (budgets.length < 100 || !budgetRes.data.has_next_page)
        hasMore = false;
      page++;

      for (const b of budgets) {
        if (
          b.budget_product_sku === "ai_credits" &&
          b.budget_scope === "organization"
        ) {
          orgAiCreditBudgetUsd = b.budget_amount; // e.g. 5000
        }
      }
    }
  } catch (error) {
    logger.warn("Could not fetch org budgets", { message: error.message });
  }

  // ─── Fetch org-level total consumption ───────────────────────────────────
  // Used to compute each user's % share of the shared pool.
  let orgGrossCredits = 0;
  let orgNetAmountUsd = 0;
  try {
    const orgUsageRes = await apiExecutor(() =>
      axios({
        method: "GET",
        url: `https://api.github.com/organizations/${org}/settings/billing/ai_credit/usage`,
        headers,
        // no ?user filter → org total
      })
    );
    const orgItems = orgUsageRes.data.usageItems || [];
    orgGrossCredits = orgItems.reduce((s, i) => s + (i.grossQuantity || 0), 0);
    orgNetAmountUsd = orgItems.reduce((s, i) => s + (i.netAmount || 0), 0);
  } catch (error) {
    logger.warn("Could not fetch org-level AI credit usage", {
      message: error.message,
    });
  }

  const seats = [];
  let rows = [];
  const fallbackDate = new Date().toISOString();

  // ─── Fetch seats ──────────────────────────────────────────────────────────
  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const seatsRes = await apiExecutor(() =>
          axios({
            method: "GET",
            url: `https://api.github.com/orgs/${org}/copilot/billing/seats`,
            headers,
            params: { per_page: 100, page },
          })
        );

        const seatsData = seatsRes.data;
        const batch = seatsData.seats || [];
        if (batch.length < 100) hasMore = false;
        page++;

        await Promise.all(
          batch.map(async (s) => {
            const username = (s.assignee && s.assignee.login) || "unknown";
            const teamName =
              (s.assigning_team && s.assigning_team.name) ||
              ESTIMATION_CONFIG.defaultTeam;

            // ── Per-user credit usage (filtered from org pool) ──────────────
            let usageItems = [];
            try {
              const creditRes = await apiExecutor(() =>
                axios({
                  method: "GET",
                  url: `https://api.github.com/organizations/${org}/settings/billing/ai_credit/usage`,
                  headers,
                  params: { user: username },
                })
              );
              usageItems = creditRes.data.usageItems || [];
            } catch (error) {
              logger.error(`Credit fetch failed for ${username}`, {
                message: error.message,
              });
            }

            // ── Correct aggregations ────────────────────────────────────────
            // grossQuantity = raw AI credit units (NOT dollars)
            // grossAmount   = grossQuantity × $0.01  → dollars consumed before discount
            // discountAmount= dollars covered by the Copilot plan's included allowance
            // netAmount     = grossAmount − discountAmount → dollars actually billed to org
            const grossCredits = usageItems.reduce(
              (acc, i) => acc + (i.grossQuantity || 0),
              0
            );
            const grossAmount = usageItems.reduce(
              (acc, i) => acc + (i.grossAmount || 0),
              0
            );
            const netCredits = usageItems.reduce(
              (acc, i) => acc + (i.netQuantity || 0),
              0
            );
            const netAmount = usageItems.reduce(
              (acc, i) => acc + (i.netAmount || 0),
              0
            );
            const discountAmount = usageItems.reduce(
              (acc, i) => acc + (i.discountAmount || 0),
              0
            );

            // ── Per-user "fair share" (informational only — pool is shared) ──
            // There is no per-user budget in zytedata. We show each user's
            // share of the org pool as a percentage, not a hard cap.
            const poolSharePct =
              orgGrossCredits > 0
                ? Math.round((grossCredits / orgGrossCredits) * 10000) / 100
                : 0;

            seats.push({
              user: username,
              team: teamName,
              last_activity: (s.last_activity_at || "").substring(0, 10),
              last_editor: s.last_activity_editor || "",
              plan: s.plan_type || "business",

              // ── Credit fields (raw units, not $) ──
              gross_credits: Math.round(grossCredits * 100) / 100,
              net_credits: Math.round(netCredits * 100) / 100,

              // ── Dollar fields ──
              gross_amount: Math.round(grossAmount * 100) / 100, // $ consumed
              net_amount: Math.round(netAmount * 100) / 100, // $ actually billed
              discount_amount: Math.round(discountAmount * 100) / 100, // $ saved by plan
              price_per_unit: 0.01,

              // ── Budget / limit ──
              // null = no individual cap (org-pool is shared, not per-user)
              limit_usd: null,
              spend_usd: Math.round(netAmount * 100) / 100, // gross $ for display
              remaining_usd: null,

              // ── Org pool share ──
              pool_share_pct: poolSharePct,
            });

            // ── Rows for activity table (only users who consumed credits) ────
            if (grossCredits > 0) {
              rows.push({
                date: fallbackDate,
                user: username,
                team: teamName,
                editor: s.last_activity_editor || "unknown",
                language: "unknown",
                model: "copilot-ai-credits",
                gross_credits: Math.round(grossCredits * 100) / 100,
                gross_amount: Math.round(grossAmount * 100) / 100,
                net_credits: Math.round(netCredits * 100) / 100,
                net_amount: Math.round(netAmount * 100) / 100,
                cost_usd: Math.round(netAmount * 100) / 100,
                engaged: 1,
              });
            }
          })
        );
      } catch (err) {
        hasMore = false;
        throw err;
      }
    }
  } catch (error) {
    logger.error("Failed to fetch Copilot seats:", { message: error.message });
  }

  // ─── Fetch & Parse NDJSON Reports ────────────────────────────────────────
  try {
    const repRes = await apiExecutor(() =>
      axios({
        method: "GET",
        url: `https://api.github.com/orgs/${org}/copilot/metrics/reports/users-28-day/latest`,
        headers,
      })
    );

    const repData = repRes.data;
    const links = repData.download_links || [];
    const parsedRows = [];

    for (const link of links) {
      const dlRes = await apiExecutor(() =>
        axios({ method: "GET", url: link, responseType: "text" })
      );

      const text = dlRes.data;
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        const record = JSON.parse(line);
        const date = record.day_partition || "unknown-date";
        const username = record.user_login || "unknown-user";
        const chats = record.user_initiated_interaction_count || 0;
        const models = record.totals_by_language_model || [];

        if (models.length === 0) {
          if (chats > 0 || record.used_chat) {
            parsedRows.push({
              date,
              user: username,
              team: ESTIMATION_CONFIG.defaultTeam,
              editor: "unknown",
              language: "unknown",
              model: "unknown",
              suggestions: 0,
              acceptances: 0,
              lines_suggested: 0,
              lines_accepted: 0,
              chats,
              engaged: 1,
            });
          }
          continue;
        }

        for (const interaction of models) {
          parsedRows.push({
            date,
            user: username,
            team: interaction.team || ESTIMATION_CONFIG.defaultTeam,
            editor: interaction.editor || "unknown",
            language: interaction.language || "unknown",
            model: interaction.model || "unknown",
            suggestions: interaction.suggestions_count || 0,
            acceptances: interaction.acceptances_count || 0,
            lines_suggested: interaction.lines_suggested || 0,
            lines_accepted: interaction.lines_accepted || 0,
            chats,
            engaged: interaction.acceptances_count > 0 ? 1 : 0,
          });
        }
      }
    }

    if (parsedRows.length > 0) rows = parsedRows;
  } catch (error) {
    logger.error("Failed to fetch/parse NDJSON reports:", {
      message: error.message,
    });
  }

  logger.debug(`Copilot rows: ${JSON.stringify(rows, null, 2)}`);
  logger.debug(`Copilot seats: ${JSON.stringify(seats, null, 2)}`);

  const result = {
    copilot: rows,
    copilot_seats: seats,

    // ── Org-level summary (for dashboard header cards) ──
    org_ai_credits: {
      budget_usd: orgAiCreditBudgetUsd, // 5000
      budget_credits: orgAiCreditBudgetUsd ? orgAiCreditBudgetUsd / 0.01 : null, // 500000
      gross_credits_used: Math.round(orgGrossCredits * 100) / 100,
      net_amount_usd: Math.round(orgNetAmountUsd * 100) / 100,
      utilization_pct:
        orgAiCreditBudgetUsd && orgAiCreditBudgetUsd > 0
          ? Math.round((orgNetAmountUsd / orgAiCreditBudgetUsd) * 10000) / 100
          : null,
    },
  };

  // 4. Persist to file cache
  writeCache(COPILOT_CACHE_FILE, result);

  return result;
}

export { fetchClaudeData, fetchCopilotData };
