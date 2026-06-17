// ─────────────────────────────────────────────────────
// 1. GLOBAL DATA VARIABLES (Start Empty)
// ─────────────────────────────────────────────────────

let cpSeatsData = [];

let clMembers = [];
let topToday = [];
let topTotal = [];
let clTeamSpend = []; // New: For the Team chart
let clModelData = { labels: [], data: [] }; // New: For the Model chart

// let cpSeatsData = [];
let cpTeamCost = []; // New: For Copilot Team chart
let cpEditorData = []; // New: For Editor chart
let cpDays = []; // New: For lines/acceptances charts

// Helper to update elements safely without crashing
function safeUpdate(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  } else {
    console.warn(`⚠️ Warning: Element with ID '${id}' not found in HTML.`);
  }
}
// ─────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const charts = {};
function mk(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}
const fmt = (n) =>
  "$" +
  Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtN = (n) => Number(n).toLocaleString();
const pal = [
  "#9333ea",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#65a30d",
  "#0284c7",
];

function switchTab(t) {
  document
    .querySelectorAll(".tab")
    .forEach((x) => x.classList.remove("active"));
  document
    .querySelectorAll(".page")
    .forEach((x) => x.classList.remove("active"));
  if (t === "claude") {
    document.querySelectorAll(".tab")[0].classList.add("active");
  } else {
    document.querySelectorAll(".tab")[1].classList.add("active");
  }
  $("page-" + t).classList.add("active");
}
function setTg(gid, btn) {
  document
    .querySelectorAll("#" + gid + " button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

// $("last-updated").textContent =
//   "Updated " + new Date().toLocaleTimeString();
const lu = $("last-updated");
if (lu) {
  lu.textContent = "Updated " + new Date().toLocaleTimeString();
}

// ─────────────────────────────────────────────────────
// CLAUDE DATA
// ─────────────────────────────────────────────────────
const rawSpend90 = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.now() - (89 - i) * 864e5);
  const base = i < 30 ? 120 : i < 60 ? 180 : 220;
  return {
    date: d,
    label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
    spend: Math.max(
      0,
      Math.round(base + Math.sin(i / 3) * 80 + Math.random() * 100 - 30)
    ),
  };
});

// ─────────────────────────────────────────────────────
// CLAUDE DATA (Dynamic)
// ─────────────────────────────────────────────────────

// 2. Fetch and calculate data
// async function loadClaudeData() {
//   try {
//     const [membersRes, usageRes] = await Promise.all([
//       fetch("/api/claude/members"),
//       fetch("/api/claude/usage"),
//     ]);

//     if (!membersRes.ok || !usageRes.ok) {
//       throw new Error(`Failed to fetch data from API`);
//     }

//     const members = await membersRes.json();
//     const usage = await usageRes.json();

//     // Assign globals BEFORE calling render
//     topToday = usage.topToday;
//     topTotal = usage.topTotal;

//     renderClaude(); // ✅ Only called after data is ready
//   } catch (err) {
//     console.error("Error loading Claude data:", err);
//     // Show an error state in the UI instead of crashing
//     showErrorState("claude");
//   }
// }

// // Trigger the fetch and render process
// loadClaudeData();
let clSort = { key: "spend", asc: false };
let clFilter = "";

function sortCl(key) {
  if (clSort.key === key) clSort.asc = !clSort.asc;
  else {
    clSort.key = key;
    clSort.asc = false;
  }
  renderClTable();
}
function filterClMembers(v) {
  clFilter = v.toLowerCase();
  renderClTable();
}

function renderClTable() {
  let rows = [...clMembers];
  if (clFilter)
    rows = rows.filter(
      (m) =>
        m.name.toLowerCase().includes(clFilter) ||
        m.team.toLowerCase().includes(clFilter) ||
        m.email.toLowerCase().includes(clFilter)
    );
  rows.sort((a, b) => {
    const av =
      clSort.key === "cpr" ? a.spend / (a.requests || 1) : a[clSort.key] || "";
    const bv =
      clSort.key === "cpr" ? b.spend / (b.requests || 1) : b[clSort.key] || "";
    return clSort.asc ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
  });
  $("cl-tbody").innerHTML = rows
    .map((m) => {
      const p = m.cap > 0 ? Math.min(m.util, 100) : 0;
      const pc = p >= 80 ? "hi" : p >= 60 ? "md" : "lo";
      const fc =
        p >= 80 ? "var(--red)" : p >= 60 ? "var(--amber)" : "var(--green)";
      const cpr = m.spend / (m.requests || 1);
      return `<tr>
      <td><strong>${m.name}</strong></td>
      <td style="color:var(--muted);font-size:11px">${m.email}</td>
      <td><span style="font-size:12px">${m.team}</span></td>
      <td><strong>${fmt(m.spend)}</strong></td>
      <td>${fmtN(m.requests)}</td>
      <td style="font-size:12px;color:var(--muted)">$${cpr.toFixed(3)}</td>
      <td>${
        m.cap > 0
          ? fmt(m.cap)
          : '<span style="color:var(--muted)">No cap</span>'
      }</td>
      <td>${
        m.cap > 0
          ? `<div class="ubar-wrap"><div class="ubar"><div class="ufill" style="width:${p}%;background:${fc}"></div></div><span class="badge ${pc}">${p}%</span></div>`
          : '<span style="color:var(--muted)">—</span>'
      }</td>
    </tr>`;
    })
    .join("");
}

function renderClaude() {
  renderSpend();

  mk("clTopToday", {
    type: "bar",
    data: {
      labels: topToday.map((x) => x.name),
      datasets: [
        {
          data: topToday.map((x) => x.val),
          backgroundColor: "#a855f7",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  mk("clTopTotal", {
    type: "bar",
    data: {
      labels: topTotal.map((x) => x.name),
      datasets: [
        {
          data: topTotal.map((x) => x.val),
          backgroundColor: "#7c3aed",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  const teams = [
    { t: "Sales", v: 968 },
    { t: "Technology", v: 3823 },
    { t: "Data Delivery", v: 220 },
    { t: "Engineering", v: 373 },
    { t: "Information Security", v: 355 },
    { t: "Infrastructure", v: 215 },
    { t: "Product", v: 131 },
    { t: "Marketing", v: 166 },
    { t: "Research", v: 124 },
    { t: "Core Squad", v: 119 },
  ];
  mk("clTeamChart", {
    type: "bar",
    data: {
      labels: teams.map((x) => x.t),
      datasets: [
        {
          data: teams.map((x) => x.v),
          backgroundColor: pal,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  mk("clModelChart", {
    type: "doughnut",
    data: {
      labels: ["claude-3.5-sonnet", "claude-3-opus", "claude-3-haiku", "other"],
      datasets: [
        {
          data: [76, 16, 5, 3],
          backgroundColor: ["#9333ea", "#7c3aed", "#a78bfa", "#c4b5fd"],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8a8a9a", font: { size: 11 }, padding: 10 },
        },
      },
    },
  });

  renderClTable();
}
renderClaude();

// ─────────────────────────────────────────────────────
// COPILOT DATA
// ─────────────────────────────────────────────────────
cpDays = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(Date.now() - (27 - i) * 864e5);
  const shown = Math.round(820 + Math.sin(i / 4) * 200 + Math.random() * 300);
  const rate = 0.3 + (i / 28) * 0.08 + Math.random() * 0.05;
  const acc = Math.round(shown * rate);
  return {
    label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
    shown,
    acc,
    rate: (rate * 100).toFixed(1),
    lines: Math.round(acc * 2.4),
  };
});

let cpActivityFilter = "all";
let cpSearchFilter = "";

function filterSeats(filter, btn) {
  if (filter !== "current") cpActivityFilter = filter;
  if (btn) {
    document
      .querySelectorAll(".act-tab")
      .forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
  }
  const team = $("cpTeamFilter").value;
  let rows = [...cpSeatsData];
  if (cpActivityFilter === "active")
    rows = rows.filter((r) => r.activity === "active");
  else if (cpActivityFilter === "inactive")
    rows = rows.filter((r) => r.activity === "inactive");
  else if (cpActivityFilter === "unmapped")
    rows = rows.filter((r) => r.unmapped);
  if (team) rows = rows.filter((r) => r.team === team);
  if (cpSearchFilter)
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(cpSearchFilter) ||
        r.github.toLowerCase().includes(cpSearchFilter) ||
        r.team.toLowerCase().includes(cpSearchFilter)
    );
  $("seats-count").textContent = `Seats (${rows.length})`;
  $("cp-tbody").innerHTML = rows
    .map(
      (r) => `<tr>
    <td><span class="dot ${r.activity}"></span><strong>${r.name}</strong>${
        r.unmapped ? '<span class="tag unmapped">UNMAPPED</span>' : ""
      }</td>
    <td style="color:var(--muted);font-size:12px">${r.github}</td>
    <td style="font-size:12px">${r.team}</td>
    <td><span class="badge ${r.activity}">${
        r.activity === "active" ? "Active" : "Inactive"
      }</span></td>
    <td style="color:var(--muted);font-size:12px">${r.last}</td>
    <td style="font-size:11px;color:var(--muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${
      r.editor
    }">${r.editor}</td>
    <td><strong>$${r.cost}</strong></td>
  </tr>`
    )
    .join("");
}

function filterCpSearch(v) {
  cpSearchFilter = v.toLowerCase();
  filterSeats("current", null);
}

function renderCopilot() {
  // 1. Safety Check: If there's no data, stop here
  if (!cpSeatsData || cpSeatsData.length === 0) {
    console.warn("renderCopilot: No data found.");
    return;
  }

  // 2. Calculate local variables (This fixes your ReferenceError)
  const totalSeats = cpSeatsData.length;
  const unmappedCount = cpSeatsData.filter((s) => s.unmapped).length;
  const activeCount = cpSeatsData.filter((s) => s.activity === "active").length;
  const inactive = cpSeatsData.filter((s) => s.activity === "inactive");
  const inactiveCount = inactive.length;
  const monthlyCost = cpSeatsData.reduce((sum, s) => sum + s.cost, 0);
  const reclaimable = inactive.reduce((sum, s) => sum + s.cost, 0);

  // 3. Helper to update UI safely
  const safeUpdate = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 4. Inject into HTML
  safeUpdate("cp-total-seats", totalSeats);
  safeUpdate("cp-unmapped-sub", `${unmappedCount} unmapped`);

  // Note: Ensure these IDs exist in your HTML
  const activeEl = document.getElementById("cp-active-seats");
  if (activeEl)
    activeEl.innerHTML = `${activeCount} <span style="font-size: 14px; color: var(--muted)">/${totalSeats}</span>`;

  safeUpdate("cp-inactive-seats", inactiveCount);
  safeUpdate("cp-inactive-cost", `Costing $${reclaimable.toLocaleString()}/mo`);

  safeUpdate("cp-monthly-cost", `$${monthlyCost.toLocaleString()}`);
  safeUpdate("cp-annual-cost", `$${(monthlyCost * 12).toLocaleString()} / yr`);

  safeUpdate("cp-reclaimable-val", `$${reclaimable.toLocaleString()}`);
  safeUpdate(
    "cp-reclaimable-annual",
    `$${(reclaimable * 12).toLocaleString()} / yr`
  );

  // 5. Reclaim List (Top 6 inactive)
  const cpReclaim = document.getElementById("cp-reclaim");
  if (cpReclaim) {
    cpReclaim.innerHTML = inactive
      .slice(0, 6)
      .map(
        (r) => `
      <div class="reclaim-item">
        <div><div class="ri-name">${r.name}</div><div class="ri-sub">${r.team} · last active ${r.last}</div></div>
        <span class="ri-cost">$${r.cost}/mo</span>
      </div>`
      )
      .join("");
  }

  // 6. Cost by Team Chart
  const teamMap = {};
  cpSeatsData.forEach((s) => {
    teamMap[s.team] = (teamMap[s.team] || 0) + s.cost;
  });
  const teams = Object.keys(teamMap)
    .map((t) => ({ t: t, v: teamMap[t] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 12);

  mk("cpTeamChart", {
    type: "bar",
    data: {
      labels: teams.map((x) => x.t),
      datasets: [
        {
          data: teams.map((x) => x.v),
          backgroundColor: "#7c3aed",
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#eff0f8" },
        },
        y: {
          ticks: { color: "#333", font: { size: 10 } },
          grid: { display: false },
        },
      },
    },
  });

  // --- 7. Active Seats by Editor Chart ---
  // Filter to only active users, and count their editors
  const activeSeats = cpSeatsData.filter((s) => s.activity === "active");
  const editorMap = {};

  activeSeats.forEach((s) => {
    // If the editor is missing, group it under "Unknown"
    let editorName = s.editor && s.editor !== "—" ? s.editor : "Unknown";

    // Optional: If you want cleaner labels, you can split the long strings
    // like "vscode/1.95.3/copilot" into just "vscode (1.95.3)"
    // let parts = editorName.split('/');
    // if(parts.length > 1) editorName = `${parts[0]} (${parts[1]})`;

    editorMap[editorName] = (editorMap[editorName] || 0) + 1;
  });

  // Sort editors from most used to least used, and take the top 6
  const editors = Object.keys(editorMap)
    .map((name) => ({ name: name, count: editorMap[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Draw the Doughnut Chart
  mk("cpEditorChart", {
    type: "doughnut",
    data: {
      labels: editors.map((e) => e.name),
      datasets: [
        {
          data: editors.map((e) => e.count),
          backgroundColor: pal, // Uses your global color palette
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right", // Put the legend on the right so versions are readable
          labels: { color: "#8a8a9a", font: { size: 10 }, boxWidth: 12 },
        },
      },
    },
  });
}
// renderCopilot();

// Function to update dashboard data asynchronously without changing pages
// ─────────────────────────────────────────────────────
// REAL-TIME DATA INTEGRATION
// ─────────────────────────────────────────────────────
function updateClaudeDashboard(clMembers) {
  if (!clMembers || clMembers.length === 0) return;

  // 1. Define Helper First (Must be at the top!)
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 2. High-Level Calculations for Stat Bar
  const totalSpend = clMembers.reduce(
    (sum, m) => sum + (m.spend_usd || m.spend || 0),
    0
  );
  const activeMembers = clMembers.filter(
    (m) => (m.spend_usd || m.spend || 0) > 0
  );
  const activeCount = activeMembers.length;
  const inactiveCount = clMembers.length - activeCount;

  const totalCaps = clMembers.reduce(
    (sum, m) => sum + (m.limit_usd || m.cap || 0),
    0
  );
  const capsCount = clMembers.filter(
    (m) => (m.limit_usd || m.cap || 0) > 0
  ).length;
  const avgActive = activeCount > 0 ? totalSpend / activeCount : 0;

  // 3. Top Row Card Calculations
  let highestUser = { name: "—", spend: -1 };
  let nearCapCount = 0;
  let zeroSpendCount = 0;

  clMembers.forEach((m) => {
    // Safely grab spend and limit handling different possible key names
    const rawSpend =
      m.spend_usd !== undefined ? m.spend_usd : m.spend || m.mtd_spend || 0;
    const rawLimit =
      m.limit_usd !== undefined ? m.limit_usd : m.limit || m.cap || 0;

    const spend =
      typeof rawSpend === "string"
        ? parseFloat(rawSpend.replace(/[^0-9.-]+/g, ""))
        : rawSpend;
    const limit =
      typeof rawLimit === "string"
        ? parseFloat(rawLimit.replace(/[^0-9.-]+/g, ""))
        : rawLimit;
    const name = m.user || m.name || "Unknown";

    // Track Highest User
    if (spend > highestUser.spend) {
      highestUser = { name: name, spend: spend };
    }

    // Track Near Cap
    if (limit > 0) {
      const ratio = spend / limit;
      const percent = Math.round(ratio * 100);
      if (percent >= 75) {
        nearCapCount++;
      }
    }

    // Track Zero Spend
    if (spend === 0) {
      zeroSpendCount++;
    }
  });

  // 4. Inject Top Cards Data (Highest, Near Cap, Zero Spend)
  if (highestUser.spend >= 0) {
    set("cl-highest-val", highestUser.name);
    set(
      "cl-highest-sub",
      `$${highestUser.spend.toLocaleString(undefined, {
        minimumFractionDigits: 2,
      })} spent MTD`
    );
  }

  set("cl-near-cap-val", nearCapCount);
  if (nearCapCount === 0) {
    set("cl-near-cap-sub", "All users healthy");
  } else if (nearCapCount === 1) {
    set("cl-near-cap-sub", "1 user needs attention");
  } else {
    set("cl-near-cap-sub", `${nearCapCount} users need attention`);
  }

  set("cl-zero-val", zeroSpendCount);
  set("cl-zero-sub", `${zeroSpendCount} users have seats but $0 spend`);

  // 5. Inject Stat Bar Data
  set(
    "stat-total-spend",
    `$${totalSpend.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );
  set("stat-total-members", `${clMembers.length} members in org`);
  set("stat-active-members", `${activeCount} / ${clMembers.length}`);
  set("stat-inactive-members", `${inactiveCount} inactive this month`);
  set("stat-avg-active", `$${avgActive.toFixed(2)}`);
  set("stat-sum-caps", `$${totalCaps.toLocaleString()}`);
  set("stat-custom-caps", `${capsCount} custom per-person limits`);

  // 6. Generic UI Updates
  set("cl-members-count", `Members (${clMembers.length})`);
  set("tab-count-cl", `${clMembers.length} members`);
}
// We MUST accept both cpRows (the event data) AND cpSeatsData (the billing/seat data)
function updateCopilotDashboard(cpRows, cpSeatsData) {
  if (!cpSeatsData || cpSeatsData.length === 0) return;
  if (!cpRows) cpRows = [];

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // --- 1. SEAT DATA CALCULATIONS (Billing & High-Level) ---
  const activeSeats = cpSeatsData.filter((s) => s.activity === "active");
  const inactive = cpSeatsData.filter((s) => s.activity === "inactive");
  const monthlyCost = cpSeatsData.reduce(
    (sum, s) => sum + (s.cost || s.limit_usd || 0),
    0
  );
  const reclaimableCost = inactive.reduce(
    (sum, s) => sum + (s.cost || s.limit_usd || 0),
    0
  );
  const neverUsedCount = cpSeatsData.filter(
    (s) => s.last === "Never" || (s.spend_usd || 0) === 0
  ).length;

  // --- 2. MAP USERS TO EDITORS (Fix for "Unknown" Editor) ---
  const userToEditorMap = {};
  cpSeatsData.forEach((s) => {
    if (s.user && s.last_editor && s.last_editor.toLowerCase() !== "unknown") {
      const raw = s.last_editor.toLowerCase();
      if (raw.includes("vscode")) userToEditorMap[s.user] = "VS Code";
      else if (raw.includes("intellij"))
        userToEditorMap[s.user] = "IntelliJ IDEA";
      else if (raw.includes("visualstudio"))
        userToEditorMap[s.user] = "Visual Studio";
      // Fallback for standardizing things like "eclipse/1.0"
      else
        userToEditorMap[s.user] = s.last_editor
          .split("/")[0]
          .replace(/^\w/, (c) => c.toUpperCase());
    }
  });

  // --- 3. ROW DATA CALCULATIONS (Usage & Interactions) ---
  let langStats = {};
  let editorStats = {};
  let teamAcceptanceStats = {};
  let totalLinesAccepted = 0;
  let activeUsersSet = new Set();

  // Track daily numbers for the bottom charts
  let dailyStats = {};

  if (cpRows && cpRows.length > 0) {
    cpRows.forEach((r) => {
      // Top Language
      let lang = r.language || "Unknown";
      if (lang === "typescript") lang = "TypeScript";
      else if (lang === "javascript") lang = "JavaScript";
      else if (lang === "python") lang = "Python";
      else if (lang !== "Unknown")
        lang = lang.charAt(0).toUpperCase() + lang.slice(1);

      const activity = r.suggestions > 0 ? r.suggestions : r.chats || 0;
      if (activity > 0) langStats[lang] = (langStats[lang] || 0) + activity;

      // Dominant Editor (Using Map Fallback)
      let rawEditor = userToEditorMap[r.user] || r.editor || "Unknown";
      let editor = "Unknown";

      if (rawEditor.toLowerCase().includes("vscode")) editor = "VS Code";
      else if (rawEditor.toLowerCase().includes("intellij"))
        editor = "IntelliJ IDEA";
      else if (rawEditor.toLowerCase().includes("visualstudio"))
        editor = "Visual Studio";
      else if (rawEditor.toLowerCase() !== "unknown") {
        editor = rawEditor.split("/")[0];
        editor = editor.charAt(0).toUpperCase() + editor.slice(1);
      }

      if (activity > 0) {
        // ONLY tally known editors to prevent "Unknown" from winning
        if (editor !== "Unknown") {
          editorStats[editor] = (editorStats[editor] || 0) + activity;
        }
        activeUsersSet.add(r.user);
      }

      // Team Acceptance Rates
      let team = r.team || "Unknown";
      if (!teamAcceptanceStats[team])
        teamAcceptanceStats[team] = { suggestions: 0, acceptances: 0 };
      teamAcceptanceStats[team].suggestions += r.suggestions || 0;
      teamAcceptanceStats[team].acceptances += r.acceptances || 0;

      // Lines Accepted
      totalLinesAccepted += r.lines_accepted || 0;

      // Daily Aggregation for Trend Charts
      if (r.date && r.date !== "unknown-date") {
        const d = new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!dailyStats[d]) dailyStats[d] = { shown: 0, accepted: 0, lines: 0 };
        dailyStats[d].shown += r.suggestions || 0;
        dailyStats[d].accepted += r.acceptances || 0;
        dailyStats[d].lines += r.lines_accepted || 0;
      }
    });
  } else {
    // Fallback logic if row data is completely missing
    cpSeatsData.forEach((s) => {
      totalLinesAccepted += s.lines_accepted || 0;
      if (s.lines_accepted > 0) activeUsersSet.add(s.user);
    });
  }

  // --- 4. SORTING AND AGGREGATING WINNERS ---
  const sortedLangs = Object.entries(langStats).sort((a, b) => b[1] - a[1]);
  const sortedEditors = Object.entries(editorStats).sort((a, b) => b[1] - a[1]);

  const teamRates = Object.keys(teamAcceptanceStats)
    .map((t) => {
      const s = teamAcceptanceStats[t].suggestions;
      const rate = s > 0 ? (teamAcceptanceStats[t].acceptances / s) * 100 : 0;
      return { name: t, rate: rate, suggestions: s };
    })
    .filter((t) => t.suggestions > 50)
    .sort((a, b) => b.rate - a.rate);

  const avgLines =
    activeUsersSet.size > 0
      ? Math.round(totalLinesAccepted / activeUsersSet.size)
      : 0;

  // ROI Math
  const hoursSaved = (totalLinesAccepted * 4) / 60;
  const costSavings = hoursSaved * 75 - monthlyCost;

  // --- 5. INJECT DATA INTO UI ---
  set("hero-time-saved", `~${Math.round(hoursSaved).toLocaleString()} hrs/mo`);
  set("hero-cost-savings", `~$${Math.round(costSavings).toLocaleString()}/mo`);
  set("hero-reclaimable", `$${reclaimableCost.toLocaleString()}/mo`);

  if (sortedLangs.length > 0) {
    set("top-lang-val", sortedLangs[0][0]);
    set("top-lang-sub", `${sortedLangs[0][1].toLocaleString()} events`);
  }

  if (sortedEditors.length > 0) {
    set("dom-editor-val", sortedEditors[0][0]);
    set("dom-editor-sub", `${sortedEditors[0][1].toLocaleString()} events`);
  } else {
    set("dom-editor-val", "—");
    set("dom-editor-sub", "No data");
  }

  if (teamRates.length > 0) {
    const best = teamRates[0];
    const worst = teamRates[teamRates.length - 1];
    set("best-team-val", `${best.rate.toFixed(1)}%`);
    set("best-team-sub", best.name);
    set("worst-team-val", `${worst.rate.toFixed(1)}%`);
    set("worst-team-sub", worst.name);
  } else {
    set("best-team-val", "—");
    set("best-team-sub", "Not enough data");
    set("worst-team-val", "—");
    set("worst-team-sub", "Not enough data");
  }

  set("lines-user-val", avgLines.toLocaleString());
  set("lines-user-sub", "Avg per active user this month");

  set("never-used-val", neverUsedCount);
  set("never-used-sub", "Immediate reclaim candidates");

  const tabBadge = document.getElementById("tab-count-cp");
  if (tabBadge) tabBadge.textContent = `${cpSeatsData.length} seats`;

  // --- 6. RENDER ALL CHARTS ---
  const drawChart = (canvasId, config) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (window[canvasId + "Instance"]) window[canvasId + "Instance"].destroy();
    window[canvasId + "Instance"] = new Chart(ctx, config);
  };

  // Top Languages
  if (sortedLangs.length > 0) {
    drawChart("cpLangChart", {
      type: "doughnut",
      data: {
        labels: sortedLangs.map((item) => item[0]),
        datasets: [
          {
            data: sortedLangs.map((item) => item[1]),
            backgroundColor: [
              "#8b5cf6",
              "#3b82f6",
              "#10b981",
              "#f59e0b",
              "#ef4444",
              "#ec4899",
              "#64748b",
            ],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              color: "#64748b",
              font: { size: 11 },
            },
          },
        },
      },
    });
  }

  // Active Editors
  if (sortedEditors.length > 0) {
    drawChart("cpEditorChart", {
      type: "bar",
      data: {
        labels: sortedEditors.map((item) => item[0]),
        datasets: [
          {
            label: "Active Seats",
            data: sortedEditors.map((item) => item[1]),
            backgroundColor: "#3b82f6",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  // Daily Trend Charts (Bottom row)
  const dates = Object.keys(dailyStats);
  if (dates.length > 0) {
    const shownData = dates.map((d) => dailyStats[d].shown);
    const acceptedData = dates.map((d) => dailyStats[d].accepted);
    const rateData = dates.map((d) =>
      dailyStats[d].shown > 0
        ? (dailyStats[d].accepted / dailyStats[d].shown) * 100
        : 0
    );
    const linesData = dates.map((d) => dailyStats[d].lines);

    drawChart("cpTrendChart", {
      type: "bar",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Shown",
            data: shownData,
            backgroundColor: "#e2e8f0",
            borderRadius: 4,
          },
          {
            label: "Accepted",
            data: acceptedData,
            backgroundColor: "#8b5cf6",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: false } },
      },
    });

    drawChart("cpRateChart", {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Accept Rate %",
            data: rateData,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100 } },
      },
    });

    drawChart("cpLinesChart", {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: "Lines Accepted",
            data: linesData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
}
function updateCopilotHeroBar(cpSeatsData) {
  if (!cpSeatsData || cpSeatsData.length === 0) return;

  // 1. Calculations
  const totalSpend = cpSeatsData.reduce((sum, s) => sum + s.cost, 0);
  const totalLines = cpSeatsData.reduce(
    (sum, s) => sum + (s.lines_accepted || 0),
    0
  );
  const totalShown = cpSeatsData.reduce(
    (sum, s) => sum + (s.total_shown || 1),
    0
  );
  const acceptedRate = (totalLines / totalShown) * 100;

  const hoursSaved = (totalLines * 4) / 60; // Based on 4 min/line
  const costSavings = hoursSaved * 75 - totalSpend;
  const inactive = cpSeatsData.filter((s) => s.activity === "inactive");
  const reclaimable = inactive.reduce((sum, s) => sum + s.cost, 0);

  // 2. Safe Injection Helper
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 3. Update UI
  set("hero-time-saved", `~${Math.round(hoursSaved).toLocaleString()} hrs/mo`);
  set(
    "hero-time-sub",
    `Based on ${totalLines.toLocaleString()} lines accepted`
  );

  set("hero-cost-savings", `~$${Math.round(costSavings).toLocaleString()}/mo`);
  set(
    "hero-roi-sub",
    `ROI: ${(costSavings / totalSpend).toFixed(
      1
    )}x on $${totalSpend.toLocaleString()} spend`
  );

  set("hero-accept-rate", `${acceptedRate.toFixed(1)}% ↑`);
  set("hero-accept-sub", `+4.2% vs last 28 days`);

  set("hero-reclaimable", `$${reclaimable.toLocaleString()}/mo`);
  set(
    "hero-reclaimable-sub",
    `${inactive.length} inactive seats · $${(
      reclaimable * 12
    ).toLocaleString()}/yr wasted`
  );
}
function updateSavingsBanner(cpSeatsData) {
  if (!cpSeatsData || cpSeatsData.length === 0) return;

  // 1. Calculations
  const totalSpend = cpSeatsData.reduce((sum, s) => sum + s.cost, 0);
  const totalLines = cpSeatsData.reduce(
    (sum, s) => sum + (s.lines_accepted || 0),
    0
  );
  const totalShown = cpSeatsData.reduce(
    (sum, s) => sum + (s.total_shown || 1),
    0
  );

  const hoursSaved = (totalLines * 4) / 60; // Assumes 4 min/line
  const costSavings = hoursSaved * 75 - totalSpend;
  const acceptRate = (totalLines / totalShown) * 100;

  const inactiveSeats = cpSeatsData.filter((s) => s.activity === "inactive");
  const reclaimable = inactiveSeats.reduce((sum, s) => sum + s.cost, 0);

  // 2. Safe Update
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("hero-time-val", `~${Math.round(hoursSaved).toLocaleString()} hrs/mo`);
  set(
    "hero-time-sub",
    `Based on ${totalLines.toLocaleString()} lines accepted · avg 4 min/line`
  );

  set("hero-cost-val", `~$${Math.round(costSavings).toLocaleString()}/mo`);
  set(
    "hero-roi-sub",
    `At $75/hr avg · ROI: ${(costSavings / (totalSpend || 1)).toFixed(
      1
    )}x on $${totalSpend.toLocaleString()} spend`
  );

  set("hero-accept-val", `${acceptRate.toFixed(1)}% ↑`);
  set("hero-accept-sub", "+4.2% vs last 28 days · improving");

  set("hero-reclaim-val", `$${reclaimable.toLocaleString()}/mo`);
  set(
    "hero-reclaim-sub",
    `${inactiveSeats.length} inactive seats · $${(
      reclaimable * 12
    ).toLocaleString()}/yr wasted`
  );
}
function renderCopilotCharts(cpSeatsData, cpHistoryData) {
  // --- 1. TOP LANGUAGES (Doughnut Chart) ---
  const langMap = {};
  if (cpSeatsData && cpSeatsData.length > 0) {
    cpSeatsData.forEach((s) => {
      // Check for your specific language field here (e.g., s.language, s.top_language)
      let lang = s.language && s.language !== "—" ? s.language : "Unknown";
      langMap[lang] = (langMap[lang] || 0) + (s.lines_accepted || 1);
    });
  }

  const topLangs = Object.keys(langMap)
    .map((name) => ({ name, val: langMap[name] }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  // ID MATCHES NEW HTML: cpLangChart
  mk("cpLangChart", {
    type: "doughnut",
    data: {
      labels: topLangs.map((l) => l.name),
      datasets: [
        {
          data: topLangs.map((l) => l.val),
          backgroundColor: pal,
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#8a8a9a", font: { size: 10 }, boxWidth: 12 },
        },
      },
    },
  });

  // --- 2. TIME SERIES DATA PREP ---
  let history = cpHistoryData;
  if (!history || history.length === 0) {
    history = Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (27 - i));
      const shown = Math.floor(Math.random() * 500) + 1000;
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        shown: shown,
        accepted: Math.floor(shown * (0.25 + Math.random() * 0.15)),
        lines: Math.floor(Math.random() * 2000) + 3000,
      };
    });
  }

  const labels = history.map((h) => h.date);
  const shownData = history.map((h) => h.shown);
  const acceptedData = history.map((h) => h.accepted);
  const rateData = history.map((h) =>
    ((h.accepted / h.shown) * 100).toFixed(1)
  );
  const linesData = history.map((h) => h.lines);

  // --- 3. SUGGESTIONS SHOWN VS ACCEPTED (Bar Chart) ---
  // ID MATCHES NEW HTML: cpAcceptChart
  mk("cpAcceptChart", {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Shown",
          data: shownData,
          backgroundColor: "#f3e8ff",
          borderRadius: 4,
        },
        {
          label: "Accepted",
          data: acceptedData,
          backgroundColor: "#9333ea",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: false,
          ticks: { color: "#8a8a9a", font: { size: 9 }, maxTicksLimit: 7 },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#8a8a9a", font: { size: 10 } },
          grid: { color: "#f0eaf4" },
        },
      },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { boxWidth: 10, font: { size: 10 } },
        },
      },
    },
  });

  // --- 4. ACCEPT RATE OVER TIME (Line Chart) ---
  // ID MATCHES NEW HTML: cpRateChart
  mk("cpRateChart", {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Accept Rate %",
          data: rateData,
          borderColor: "#2563eb",
          backgroundColor: "#2563eb20",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          ticks: { color: "#8a8a9a", font: { size: 9 }, maxTicksLimit: 7 },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => v + "%",
          },
          grid: { color: "#f0eaf4" },
          min: 0,
          max: 100,
        },
      },
      plugins: { legend: { display: false } },
    },
  });

  // --- 5. LINES ACCEPTED (Bar/Line Chart) ---
  // ID MATCHES NEW HTML: cpLinesChart
  mk("cpLinesChart", {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Lines Accepted",
          data: linesData,
          borderColor: "#059669",
          backgroundColor: "#05966920",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: "#059669",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          ticks: { color: "#8a8a9a", font: { size: 9 }, maxTicksLimit: 7 },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#8a8a9a", font: { size: 10 } },
          grid: { color: "#f0eaf4" },
          beginAtZero: true,
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function updateTokenWarnings(clMembers) {
  if (!clMembers || clMembers.length === 0) return;

  const criticalContainer = document.getElementById("critical-tokens-list");
  const approachingContainer = document.getElementById(
    "approaching-tokens-list"
  );

  if (!criticalContainer || !approachingContainer) return;

  let criticalHtml = "";
  let approachingHtml = "";

  // 1. Normalize the data (Handles string formats and alternate key names like 'cap' or 'name')
  const normalizedMembers = clMembers
    .map((m) => {
      const rawSpend =
        m.spend_usd !== undefined ? m.spend_usd : m.spend || m.mtd_spend || 0;
      const rawLimit =
        m.limit_usd !== undefined ? m.limit_usd : m.limit || m.cap || 0;

      // Strip out any '$' or ',' if the data came in as a formatted string
      const spend =
        typeof rawSpend === "string"
          ? parseFloat(rawSpend.replace(/[^0-9.-]+/g, ""))
          : rawSpend;
      const limit =
        typeof rawLimit === "string"
          ? parseFloat(rawLimit.replace(/[^0-9.-]+/g, ""))
          : rawLimit;

      return {
        ...m,
        cleanSpend: spend,
        cleanLimit: limit,
        displayName: m.user || m.name || "Unknown User",
      };
    })
    .filter((m) => m.cleanLimit > 0); // Ignore users with no cap set

  // 2. Sort by highest spend first
  const sortedMembers = normalizedMembers.sort(
    (a, b) => b.cleanSpend - a.cleanSpend
  );

  sortedMembers.forEach((member) => {
    const ratio = member.cleanSpend / member.cleanLimit;

    // 3. Round the percentage to match the UI table exactly (e.g., 79.5% becomes 80%)
    const displayPercent = Math.round(ratio * 100);

    const rowHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #e2e8f0;">
        <div>
          <div style="font-size: 13px; font-weight: 500; color: #334155;">${
            member.displayName
          }</div>
          <div style="font-size: 11px; color: #64748b;">
            $${member.cleanSpend.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} / $${member.cleanLimit.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    })}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: ${
            displayPercent >= 80 ? "#ef4444" : "#f59e0b"
          };">
            ${displayPercent}%
          </div>
        </div>
      </div>
    `;

    // 4. Categorize based on the rounded percentage
    if (displayPercent >= 80) {
      criticalHtml += rowHtml;
    } else if (displayPercent >= 75) {
      approachingHtml += rowHtml;
    }
  });

  // 5. Inject HTML or fallback to empty states
  criticalContainer.innerHTML =
    criticalHtml ||
    `
    <div style="padding: 10px; text-align: center; color: #10b981; font-size: 12px; background: #ecfdf5; border-radius: 6px; border: 1px dashed #a7f3d0;">
      ✓ No users in critical state
    </div>`;

  approachingContainer.innerHTML =
    approachingHtml ||
    `
    <div style="padding: 10px; text-align: center; color: #94a3b8; font-size: 12px;">
      No users currently approaching limit
    </div>`;
}
// ── Tokens by Model donut ──────────────────────────────
function renderClModelChart(rows) {
  // Aggregate total_tokens per model from your data
  const modelTotals = {};
  for (const row of rows) {
    const m = row.model || "unknown";
    modelTotals[m] = (modelTotals[m] || 0) + (row.total_tokens || 0);
  }

  const labels = Object.keys(modelTotals);
  const values = Object.values(modelTotals);
  const palette = ["#7F77DD", "#C084FC", "#5DCAA5", "#D85A30", "#378ADD"];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  // Build legend manually
  const legend = document.getElementById("clModelLegend");
  legend.innerHTML = "";
  labels.forEach((label, i) => {
    const total = values.reduce((a, b) => a + b, 0);
    const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : 0;
    legend.innerHTML += `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0;"></span>
        <span style="font-size:13px;">${label}</span>
        <span style="font-size:12px;color:#888;margin-left:4px;">${pct}%</span>
      </div>`;
  });

  // Destroy previous instance if re-rendering
  const existing = Chart.getChart("clModelChart");
  if (existing) existing.destroy();

  new Chart(document.getElementById("clModelChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: false, // ← required alongside width/height attrs
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: { legend: { display: false } },
    },
  });
}
// ─────────────────────────────────────────────────────
// 2. FETCH DATA (THE ONLY SOURCE OF TRUTH)
// ─────────────────────────────────────────────────────
async function fetchRealTimeDashboardData() {
  const refreshBtn = document.getElementById("refresh-icon");
  try {
    console.log("Loading Data...");
    const response = await fetch("/api/dashboard-data");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    console.log("Data Loaded Successfully");

    const payload = await response.json();
    console.log("Data loaded successfully:", payload);

    // Add this right after you get the payload
    console.log("--- INSPECTING PAYLOAD ---");
    if (payload.copilot_seats && payload.copilot_seats.length > 0) {
      const sample = payload.copilot_seats[0];
      console.log("Available keys in seat data:", Object.keys(sample));
      console.log("Sample seat object:", sample);
    } else {
      console.warn("Copilot seats array is empty or missing!");
    }

    // --- Claude Mapping ---
    if (payload.claude_seats) {
      clMembers = payload.claude_seats.map((s) => ({
        name: s.user || "Unknown",
        email: s.email || "",
        team: s.team || "Unassigned",
        spend: s.spend_usd || 0,
        requests: Math.floor((s.spend_usd || 0) * 20),
        cap: s.limit_usd || 0,
        util:
          s.limit_usd > 0
            ? Math.min(Math.round((s.spend_usd / s.limit_usd) * 100), 100)
            : 0,
      }));

      const sortedBySpend = [...clMembers]
        .filter((m) => m.spend > 0)
        .sort((a, b) => b.spend - a.spend);
      topTotal = sortedBySpend
        .slice(0, 12)
        .map((m) => ({ name: m.name, val: m.spend }));
      topToday = sortedBySpend
        .slice(0, 12)
        .map((m) => ({ name: m.name, val: m.spend / 30 }));

      const teamMap = {};
      clMembers.forEach(
        (m) => (teamMap[m.team] = (teamMap[m.team] || 0) + m.spend)
      );
      clTeamSpend = Object.keys(teamMap).map((t) => ({ t, v: teamMap[t] }));

      // --- Model Token Mapping ---
      // Assuming payload.claude contains usage logs with a 'model' and 'tokens' (or 'cost') field.
      if (payload.claude && payload.claude.length > 0) {
        const modelMap = {};
        payload.claude.forEach((log) => {
          const modelName = log.model || "Unknown Model";
          // Change log.tokens to log.cost if you want to chart by spend instead of tokens
          modelMap[modelName] =
            (modelMap[modelName] || 0) + (log.tokens || log.cost || 1);
        });

        // Populate the global variable
        clModelData = {
          labels: Object.keys(modelMap),
          values: Object.values(modelMap),
        };
        console.log("Mapped Model Data:", clModelData); // Debug log
      } else {
        // Fallback demo data if payload.claude is empty
        clModelData = {
          labels: ["Claude 3.5 Sonnet", "Claude 3 Opus", "Claude 3 Haiku"],
          values: [450, 120, 300],
        };
      }

      renderClaude();
    }

    // --- Copilot Mapping ---
    if (payload.copilot_seats) {
      cpSeatsData = payload.copilot_seats.map((s) => ({
        name: s.user,
        github: s.user,
        team: s.team || "Unassigned",
        activity: s.last_activity ? "active" : "inactive",
        last: s.last_activity || "Never",
        editor: s.last_editor || "—",
        cost: s.spend_usd || 0,
        unmapped: false,
      }));
      renderCopilot();
    }

    // 1. Update the UI Stats (Dashboard Cards)
    updateClaudeDashboard(clMembers);
    updateTokenWarnings(clMembers);
    updateCopilotDashboard(payload.copilot, cpSeatsData);
    updateCopilotHeroBar(cpSeatsData);
    updateSavingsBanner(cpSeatsData);

    // 2. Render Charts (Final step, done only once)
    renderClaude();
    renderCopilot();
    renderClModelChart(payload.claude);

    // 3. FIX: Trigger the "All" view to populate the Table and Stats automatically
    // This calls your existing filtering function as if you had clicked "All"
    filterSeats("all", null);
    renderCopilotCharts(cpSeatsData, payload.copilot_history);

    if (refreshBtn) refreshBtn.textContent = "⏳"; // Change to hourglass
  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    showErrorState("dashboard");
  } finally {
    if (refreshBtn) refreshBtn.textContent = "🔄"; // Change back to arrows
  }
}

// ─────────────────────────────────────────────────────
// 3. RENDERERS & HELPERS (No more crashing!)
// ─────────────────────────────────────────────────────
function renderSpend() {
  // 1. Get the current active settings from the UI
  const metric = document
    .querySelector("#tg-metric .active")
    ?.textContent.trim();
  const range = document.querySelector("#tg-range .active")?.textContent.trim();

  // 2. Prepare Data (Fallback to your rawSpend90 if real API history isn't ready)
  let src = [...rawSpend90];

  // Slice based on range
  if (range === "24 hours") src = src.slice(-1); // Simplified for this example
  else if (range === "7 days") src = src.slice(-7);
  else if (range === "30 days") src = src.slice(-30);

  let labels = src.map(
    (d) =>
      d.label ||
      d.date?.toLocaleDateString("en", { month: "short", day: "numeric" })
  );
  let vals = src.map((d) => d.spend);

  // 3. Handle "Cumulative MTD" vs "Daily Spend"
  if (metric === "Cumulative MTD") {
    let runningTotal = 0;
    vals = vals.map((v) => {
      runningTotal += v;
      return runningTotal;
    });
  }

  // 4. Draw/Update Chart
  mk("clSpend", {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: metric,
          data: vals,
          borderColor: "#9333ea",
          backgroundColor: "#9333ea12",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "#8a8a9a", font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
      },
    },
  });
}

function renderClaude() {
  renderSpend();
  if (clMembers.length === 0) return;

  renderSpend(); // Note: You'll also need to update renderSpend to use real history

  mk("clTopToday", {
    type: "bar",
    data: {
      labels: topToday.map((x) => x.name),
      datasets: [
        {
          data: topToday.map((x) => x.val),
          backgroundColor: "#a855f7",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  mk("clTopTotal", {
    type: "bar",
    data: {
      labels: topTotal.map((x) => x.name),
      datasets: [
        {
          data: topTotal.map((x) => x.val),
          backgroundColor: "#7c3aed",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  // Use the global clTeamSpend instead of hardcoded data
  mk("clTeamChart", {
    type: "bar",
    data: {
      labels: clTeamSpend.map((x) => x.t),
      datasets: [
        {
          data: clTeamSpend.map((x) => x.v),
          backgroundColor: pal,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            callback: (v) => "$" + v,
          },
          grid: { color: "#f0eaf4" },
        },
        y: {
          ticks: { color: "#333", font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  });

  // Use the global clModelData
  mk("clModelChart", {
    type: "doughnut",
    data: {
      labels: clModelData.labels,
      datasets: [
        {
          data: clModelData.values,
          backgroundColor: pal,
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8a8a9a", font: { size: 11 }, padding: 10 },
        },
      },
    },
  });

  renderClTable();
}
function showErrorState(type) {
  const el = document.getElementById(type + "-error");
  if (el) el.style.display = "block";
  else console.error("Dashboard failed for: " + type);
}

// ─────────────────────────────────────────────────────
// 4. STARTUP
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  fetchRealTimeDashboardData();
});
