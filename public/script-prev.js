// ─────────────────────────────────────────────────────
// 1. GLOBAL DATA VARIABLES (Start Empty)
// ─────────────────────────────────────────────────────
const wisprflow = null;

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

function exportToCSVCopilot() {
  // 1. Get the current data being shown in the table
  const data = currentCpSeats;
  if (!data || data.length === 0) return;

  // 2. Define the columns we want in our CSV
  const headers = [
    "Name",
    "GitHub",
    "Team",
    "Activity",
    "Last Activity",
    "Editor",
    "Net Credits",
    "Net Amount",
  ];

  // 3. Convert data to CSV rows
  const csvRows = [headers.join(",")]; // Add header row

  for (const row of data) {
    const values = [
      row.displayName,
      row.github || "—",
      row.team,
      row.activity,
      row.rawDate || "—",
      row.cleanEditor || "—",
      row.netCredits,
      row.netAmount,
    ];
    csvRows.push(values.join(","));
  }

  // 4. Create a Blob and trigger the download
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", "copilot_seats_report.csv");
  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
function exportToCSVClaude() {
  const data = clMembers;
  if (!data || data.length === 0) return;

  const headers = [
    "Name",
    "Email",
    "Team",
    "MTD Spend",
    "Requests",
    "Cost/Req",
    "Cap",
    "Util %",
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const csvRows = [headers.map(escapeCSV).join(",")];

  for (const row of data) {
    const costPerReq =
      row.requests > 0 ? (row.spend / row.requests).toFixed(3) : 0;

    const values = [
      row.name,
      row.email,
      row.team,
      Number(row.spend).toFixed(2),
      row.requests,
      costPerReq,
      Number(row.cap).toFixed(2),
      `${row.util}%`,
    ];

    csvRows.push(values.map(escapeCSV).join(","));
  }

  const csvString = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvString], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `claude_members_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
// Ensure you have Chart.js included in your <head> for the graphs to work!
// <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>

function populateExecutiveSummary() {
  // --- Helper formatters ---
  const money = (n) =>
    n == null
      ? "—"
      : "$" +
        Number(n).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const money0 = (n) =>
    n == null
      ? "—"
      : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

  // --- TAILWIND KPI CARD GENERATOR ---
  function kpiCard(label, value, hint) {
    return `
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div class="text-gray-500 text-xs font-semibold uppercase tracking-wider">${label}</div>
          <div class="text-2xl font-bold mt-1 tracking-tight text-gray-900">${value}</div>
        </div>
        ${hint ? `<div class="text-xs text-gray-500 mt-2">${hint}</div>` : ""}
      </div>
    `;
  }

  // 1. Populate Claude KPI Cards
  const CL = window.claudeData;
  if (CL && CL.summary) {
    const s = CL.summary;
    document.getElementById("execClaude").innerHTML =
      kpiCard(
        "MTD spend",
        money(s.total_mtd_spend),
        `proj. ${money0(s.projected_month_spend)}`
      ) +
      kpiCard("Active", `${s.active_members}/${s.member_count}`, "spend > 0") +
      kpiCard("Avg / active", money(s.avg_per_active), "") +
      kpiCard("MAU", num(s.mau), "users/month");
  }

  // 2. Populate Copilot KPI Cards
  const CP = window.copilotData;
  if (CP && CP.summary) {
    const s = CP.summary;
    document.getElementById("execCopilot").innerHTML =
      kpiCard(
        "Total cost (MTD)",
        money0(s.total_cost != null ? s.total_cost : s.seats_cost),
        `seats ${money0(s.seats_cost)} + usage ${money0(s.metered_cost || 0)}`
      ) +
      kpiCard("Active seats", `${s.active30}/${s.total_seats}`, "30 days") +
      kpiCard(
        "Reclaimable/mo",
        money0(s.reclaimable_mo),
        `${s.inactive30} inactive`
      ) +
      kpiCard("Acceptance", s.acceptance_rate + "%", "28 days");
  }

  // 3. Render Combined Charts (Claude vs Copilot)
  // We keep the original brand colors (#B02CCE and #181E5A) for the charts so they match the logos
  const labels = CL
    ? CL.daily.slice(-30).map((d) => d.date.slice(5))
    : CP && CP.daily
    ? CP.daily.slice(-30).map((d) => d.date.slice(5))
    : [];
  const ds = [];
  if (CL) {
    ds.push({
      label: "Claude",
      data: CL.daily.slice(-30).map((d) => d.cost_usd),
      borderColor: "#B02CCE",
      backgroundColor: "rgba(176,44,206,.15)",
      fill: true,
      tension: 0.3,
    });
  }
  if (CP) {
    const dim = (CL && CL.summary.days_in_month) || 30;
    const perDay = +(CP.summary.monthly_cost / dim).toFixed(2);
    ds.push({
      label: "Copilot (seats · prorated)",
      data: labels.map(() => perDay),
      borderColor: "#181E5A",
      borderDash: [5, 4],
      pointRadius: 0,
      tension: 0,
    });
  }
  if (ds.length) {
    new Chart(document.getElementById("execSpend"), {
      type: "line",
      data: { labels, datasets: ds },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { color: "#e5e7eb" } },
          y: { grid: { color: "#e5e7eb" } },
        },
      },
    });
  }

  const dl = [],
    dv = [];
  if (CL) {
    dl.push("Claude");
    dv.push(CL.summary.projected_month_spend);
  }
  if (CP) {
    dl.push("Copilot");
    dv.push(
      CP.summary.total_cost != null
        ? CP.summary.total_cost
        : CP.summary.monthly_cost
    );
  }
  if (dl.length) {
    const total = dv.reduce((a, b) => a + b, 0);
    document.getElementById("execProjCap").textContent =
      "Total projected: " +
      money0(total) +
      " · " +
      dl.map((l, i) => l + " " + money0(dv[i])).join(" · ");
    new Chart(document.getElementById("execAdopt"), {
      type: "doughnut",
      data: {
        labels: dl,
        datasets: [{ data: dv, backgroundColor: ["#B02CCE", "#181E5A"] }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: { label: (c) => c.label + ": " + money0(c.parsed) },
          },
        },
      },
    });
  }

  // 4. Populate Wispr Flow Data
  const WF = window.wisprFlowData;
  if (WF) {
    const line =
      `${num(WF.members)} members · ${num(
        WF.active_seats
      )} active seats · ${num(
        WF.words_dictated_all_time
      )} words dictated (all time)` +
      (WF.as_of ? ` · snapshot ${WF.as_of}` : "");
    document.getElementById("execWisprLine").textContent = line;

    const delta = WF.words_delta_pct;
    const trendStr =
      delta != null ? (delta >= 0 ? "+" : "") + delta + "%" : "—";

    // Add a text-green-600 or text-red-600 class directly to the trend HTML if you want it colored
    const trendHtml = `<span class="${
      delta >= 0 ? "text-green-600" : "text-red-600"
    }">${trendStr}</span>`;

    document.getElementById("execWispr").innerHTML =
      kpiCard(
        "Users",
        num(WF.members),
        `${num(WF.active_seats)} active seats`
      ) +
      kpiCard("Words dictated", num(WF.words_dictated_all_time), "all time") +
      kpiCard("Weekly trend", trendHtml, WF.words_delta_window || "") +
      kpiCard(
        "Top app",
        WF.top_apps && WF.top_apps[0]
          ? `${WF.top_apps[0].app} ${WF.top_apps[0].pct}%`
          : "—",
        "by dictation"
      );

    const apps = (WF.top_apps || []).slice(0, 10);
    if (apps.length) {
      new Chart(document.getElementById("execWisprApps"), {
        type: "bar",
        data: {
          labels: apps.map((a) => a.app),
          datasets: [
            {
              label: "% of dictation",
              data: apps.map((a) => a.pct),
              backgroundColor: [
                "#B02CCE",
                "#181E5A",
                "#009A2F",
                "#33525F",
                "#9BADB5",
                "#E8520A",
              ],
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          scales: {
            x: { grid: { color: "#e5e7eb" } },
            y: { grid: { color: "#e5e7eb" } },
          },
          plugins: { legend: { display: false } },
        },
      });
    } else {
      document.getElementById("execWisprAppsCard").style.display = "none";
    }
  } else {
    document.getElementById("execWisprTitle").style.display = "none";
    document.getElementById("execWisprLine").style.display = "none";
    document.getElementById("execWisprAppsCard").style.display = "none";
  }
}
function renderExecutiveCharts(clMembers, cpSeatsData) {
  // console.log(
  //   `Rendering Executive Charts for ${JSON.stringify(
  //     clMembers,
  //     null,
  //     2
  //   )} Claude members and ${JSON.stringify(cpSeatsData, null, 2)} Copilot seats`
  // );
  // 1. Helper formatting and colors
  const money0 = (n) =>
    n == null
      ? "—"
      : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const money2 = (n) =>
    n == null
      ? "—"
      : "$" +
        Number(n).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const colors = { claude: "#B02CCE", copilot: "#181E5A" };

  // ==========================================
  // CALCULATE SUMMARY METRICS FROM RAW DATA
  // ==========================================

  // Claude Summary
  const claudeTotalSpend = clMembers.reduce(
    (sum, m) => sum + (m.spend || 0),
    0
  );
  const claudeProjectedSpend = claudeTotalSpend; // Or multiply by days ratio if needed
  const claudeActiveMembers = clMembers.filter((m) => m.spend > 0).length;
  const claudeTotalMembers = clMembers.length;
  const claudeAvgPerActive =
    claudeActiveMembers > 0 ? claudeTotalSpend / claudeActiveMembers : 0;

  // Copilot Summary
  const copilotTotalSeats = cpSeatsData.length;
  const copilotActiveSeats = cpSeatsData.filter(
    (s) => s.activity === "active"
  ).length;
  const copilotInactiveSeats = cpSeatsData.filter(
    (s) => s.activity === "inactive"
  ).length;
  const copilotTotalCost = cpSeatsData.reduce(
    (sum, s) => sum + (s.cost || 0),
    0
  );
  const copilotReclaimable = cpSeatsData
    .filter((s) => s.activity === "inactive")
    .reduce((sum, s) => sum + (s.cost || 0), 0);

  // NEW: Unmapped seats — a seat with no matched Claude member.
  // Defensive check across the common field names a mapping step might use.
  // TODO: replace with the exact field name once confirmed, e.g.:
  //   const copilotUnmapped = cpSeatsData.filter((s) => !s.mapped).length;
  const copilotUnmapped = cpSeatsData.filter((s) => {
    if (typeof s.mapped === "boolean") return s.mapped === false;
    if ("mapped" in s) return s.mapped == null;
    return (
      !s.claude_member_id && !s.member_email && !s.matched_member && !s.assignee
    );
  }).length;

  // ==========================================
  // CHART 1: Projected end-of-month spend (Donut)
  // ==========================================
  const dl = [],
    dv = [];

  if (clMembers.length > 0) {
    dl.push("Claude");
    dv.push(claudeProjectedSpend);
  }

  if (cpSeatsData.length > 0) {
    dl.push("Copilot");
    dv.push(copilotTotalCost);
  }

  if (dl.length) {
    const total = dv.reduce((a, b) => a + b, 0);
    const cap = document.getElementById("execProjCap");

    // Update Subtitle text
    if (cap) {
      cap.textContent =
        "Total projected: " +
        money0(total) +
        " · " +
        dl.map((l, i) => l + " " + money0(dv[i])).join(" · ");
    }

    const adoptCanvas = document.getElementById("execAdopt");
    if (adoptCanvas) {
      // Destroy previous instance to prevent hover artifacts
      if (window.execAdoptChart) window.execAdoptChart.destroy();

      window.execAdoptChart = new Chart(adoptCanvas, {
        type: "doughnut",
        data: {
          labels: dl,
          datasets: [
            { data: dv, backgroundColor: [colors.claude, colors.copilot] },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (c) => c.label + ": " + money0(c.parsed),
              },
            },
          },
        },
      });
    }
  }

  // ==========================================
  // CHART 2: Daily Spend (Line Chart)
  // ==========================================
  const spendCanvas = document.getElementById("execSpend");
  if (spendCanvas) {
    // Destroy previous instance to prevent hover artifacts
    if (window.execSpendChart) window.execSpendChart.destroy();

    // For daily spend, you'll need to aggregate by date from your data
    // This is a simplified version showing total spend comparison
    const chartLabels = ["Current Month"];
    const claudeDailyData = [claudeTotalSpend];
    const copilotDailyData = [copilotTotalCost];

    window.execSpendChart = new Chart(spendCanvas, {
      type: "bar", // Changed to bar since we're showing totals
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Claude",
            data: claudeDailyData,
            backgroundColor: colors.claude + "CC",
            borderColor: colors.claude,
            borderWidth: 1,
          },
          {
            label: "Copilot",
            data: copilotDailyData,
            backgroundColor: colors.copilot + "CC",
            borderColor: colors.copilot,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "$" + value.toLocaleString();
              },
            },
          },
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (c) => c.dataset.label + ": " + money2(c.parsed.y),
            },
          },
        },
      },
    });
  }

  // ==========================================
  // POPULATE STAT CARDS
  // ==========================================

  // Claude Stats
  const statTotalSpend = document.getElementById("stat-total-spend");
  const statTotalMembers = document.getElementById("stat-total-members");
  const statActiveMembers = document.getElementById("stat-active-members");
  const statAvgActive = document.getElementById("stat-avg-active");
  const statSumCaps = document.getElementById("stat-sum-caps");
  const statCustomCaps = document.getElementById("stat-custom-caps");

  if (statTotalSpend) statTotalSpend.textContent = money2(claudeTotalSpend);
  if (statTotalMembers)
    statTotalMembers.textContent = `${claudeTotalMembers} members in org`;
  if (statActiveMembers) statActiveMembers.textContent = claudeActiveMembers;
  if (statAvgActive) statAvgActive.textContent = money2(claudeAvgPerActive);

  const totalCaps = clMembers.reduce((sum, m) => sum + (m.cap || 0), 0);
  const customCapsCount = clMembers.filter((m) => m.cap > 0).length;

  if (statSumCaps) statSumCaps.textContent = money0(totalCaps);
  if (statCustomCaps)
    statCustomCaps.textContent = `${customCapsCount} custom caps`;

  // Copilot Stats
  const cpTotalSeats = document.getElementById("cp-total-seats");
  const cpUnmappedSub = document.getElementById("cp-unmapped-sub"); // NEW
  const cpActiveSeats = document.getElementById("cp-active-seats");
  const cpInactiveSeats = document.getElementById("cp-inactive-seats");
  const cpMonthlyCost = document.getElementById("cp-monthly-cost");
  const cpAnnualCost = document.getElementById("cp-annual-cost");
  const cpInactiveCost = document.getElementById("cp-inactive-cost");
  const cpReclaimableVal = document.getElementById("cp-reclaimable-val");
  const cpReclaimableAnnual = document.getElementById("cp-reclaimable-annual");

  if (cpTotalSeats) cpTotalSeats.textContent = copilotTotalSeats;
  if (cpUnmappedSub) cpUnmappedSub.textContent = `${copilotUnmapped} unmapped`; // NEW
  if (cpActiveSeats) cpActiveSeats.textContent = copilotActiveSeats;
  if (cpInactiveSeats) {
    cpInactiveSeats.textContent = copilotInactiveSeats;
    cpInactiveSeats.className =
      copilotInactiveSeats > 0
        ? "text-2xl font-bold mt-1 tracking-tight text-red-600"
        : "text-2xl font-bold mt-1 tracking-tight text-gray-900";
  }
  if (cpMonthlyCost) cpMonthlyCost.textContent = money0(copilotTotalCost);
  if (cpAnnualCost)
    cpAnnualCost.textContent = money0(copilotTotalCost * 12) + " / yr";
  if (cpInactiveCost)
    cpInactiveCost.textContent = "Costing " + money0(copilotReclaimable);
  if (cpReclaimableVal)
    cpReclaimableVal.textContent = money0(copilotReclaimable);
  if (cpReclaimableAnnual)
    cpReclaimableAnnual.textContent = money0(copilotReclaimable * 12) + " / yr";
}
function renderWisprFlow(wisprData) {
  // Helper formatters
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

  // KPI Card Generator (Tailwind version)
  function kpiCard(label, value, hint, valueColor = "") {
    return `
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div class="text-gray-500 text-xs font-semibold uppercase tracking-wider">${label}</div>
          <div class="text-2xl font-bold mt-1 tracking-tight ${
            valueColor || "text-gray-900"
          }">${value}</div>
        </div>
        ${hint ? `<div class="text-xs text-gray-500 mt-2">${hint}</div>` : ""}
      </div>
    `;
  }

  const WF = wisprData;

  if (WF && WF.members) {
    // Show Wispr section
    const section = document.getElementById("wispr-section");
    if (section) section.classList.remove("hidden");

    // Build info line with snapshot date
    const lineElement = document.getElementById("execWisprLine");
    if (lineElement) {
      const snapshotDate = WF.as_of
        ? new Date(WF.as_of).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;

      lineElement.innerHTML = `
        <span>${num(WF.members)} members</span>
        <span class="mx-1.5">·</span>
        <span>${num(WF.active_seats)} active seats</span>
        <span class="mx-1.5">·</span>
        <span>${num(
          WF.words_dictated_all_time
        )} words dictated (all time)</span>
        ${
          snapshotDate
            ? `<span class="mx-1.5">·</span><span>snapshot ${snapshotDate}</span>`
            : ""
        }
      `;
    }

    // Calculate weekly trend
    const delta = WF.words_delta_pct;
    const trendValue =
      delta != null ? (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%" : "—";
    const trendColor =
      delta != null
        ? delta >= 0
          ? "text-green-600"
          : "text-red-600"
        : "text-gray-900";

    // Calculate average words per user
    const avgWordsPerUser =
      WF.members > 0 ? Math.round(WF.words_dictated_all_time / WF.members) : 0;

    // Calculate utilization rate
    const utilizationRate =
      WF.members > 0 ? Math.round((WF.active_seats / WF.members) * 100) : 0;

    // Populate KPI Cards
    const wisprContainer = document.getElementById("execWispr");
    if (wisprContainer) {
      wisprContainer.innerHTML =
        kpiCard(
          "Users",
          num(WF.members),
          `${num(WF.active_seats)} active (${utilizationRate}%)`
        ) +
        kpiCard(
          "Words Dictated",
          num(WF.words_dictated_all_time),
          `~${num(avgWordsPerUser)} words/user (all time)`
        ) +
        kpiCard(
          "Weekly Trend",
          trendValue,
          WF.words_delta_window || "weekly comparison",
          trendColor
        ) +
        kpiCard(
          "Billed Seats",
          num(WF.billed_seats),
          `${utilizationRate}% utilization`
        );
    }

    // Render Top Apps Chart (if data available)
    const appsCanvas = document.getElementById("execWisprApps");
    const appsCard = document.getElementById("execWisprAppsCard");

    // Check if we have app data
    if (WF.top_apps && WF.top_apps.length > 0 && appsCanvas) {
      if (appsCard) appsCard.classList.remove("hidden");

      // Destroy previous chart instance
      if (window.wisprAppsChart) window.wisprAppsChart.destroy();

      const apps = WF.top_apps.slice(0, 10);

      // Wispr Flow brand color palette
      const palette = [
        "#009A2F",
        "#00B37E",
        "#006B20",
        "#00C853",
        "#1B5E20",
        "#2E7D32",
        "#388E3C",
        "#43A047",
        "#4CAF50",
        "#66BB6A",
      ];

      window.wisprAppsChart = new Chart(appsCanvas, {
        type: "bar",
        data: {
          labels: apps.map((a) => a.app),
          datasets: [
            {
              label: "% of dictation",
              data: apps.map((a) => a.pct),
              backgroundColor: palette.slice(0, apps.length),
              borderRadius: 4,
              borderSkipped: false,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: "#e5e7eb",
              },
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
            },
            y: {
              grid: {
                display: false,
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (c) => `${c.label}: ${c.parsed.x}% of dictation`,
              },
            },
          },
        },
      });

      // Add empty state message if needed
    } else if (appsCanvas) {
      // No app data - show placeholder
      if (appsCard) {
        appsCard.classList.remove("hidden");
        const ctx = appsCanvas.getContext("2d");
        if (window.wisprAppsChart) window.wisprAppsChart.destroy();

        // Show "no data" message on canvas
        ctx.clearRect(0, 0, appsCanvas.width, appsCanvas.height);
        ctx.font = "14px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#9CA3AF";
        ctx.textAlign = "center";
        ctx.fillText(
          "No app data available",
          appsCanvas.width / 2,
          appsCanvas.height / 2
        );
      }
    }
  } else {
    // Hide entire Wispr section if no data
    const section = document.getElementById("wispr-section");
    if (section) section.classList.add("hidden");
  }
}

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
// Find your existing mk() function (around script.js:34) and replace it with this:
function mk(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  // Destroy via window registry (same pattern as drawChart in updateCopilotDashboard)
  if (window[canvasId + "Instance"]) {
    window[canvasId + "Instance"].destroy();
    window[canvasId + "Instance"] = null;
  }

  // Also catch any orphaned Chart.js instance not in the registry
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();

  window[canvasId + "Instance"] = new Chart(ctx, config);
  return window[canvasId + "Instance"];
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

function switchTab(targetPageId) {
  // 1. Find all elements with the class 'page' and hide them
  const allPages = document.querySelectorAll(".page");
  allPages.forEach((page) => {
    page.style.display = "none";
    page.classList.remove("active");
  });

  // 2. Remove 'active' styling from all tab buttons
  const allTabs = document.querySelectorAll(".tab");
  allTabs.forEach((tab) => {
    tab.classList.remove("active");
  });

  // 3. Find the target page and show it
  const targetPage = document.getElementById(targetPageId);
  if (targetPage) {
    targetPage.style.display = "block";
    targetPage.classList.add("active");
  }

  // 4. Highlight the button that was clicked
  // We determine which button to highlight based on the passed ID
  let buttonClass = "";
  if (targetPageId === "page-exec") buttonClass = "exec";
  if (targetPageId === "page-claude") buttonClass = "cl";
  if (targetPageId === "page-copilot") buttonClass = "cp";

  if (buttonClass) {
    const activeBtn = document.querySelector(`.tab.${buttonClass}`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }
  }
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

function formatEditorName(editorRaw) {
  if (!editorRaw || editorRaw === "—") return "—";

  const str = editorRaw.toLowerCase();

  // Map common telemetry strings to clean names
  if (str.includes("vscode")) return "VS Code";
  if (str.includes("visualstudio")) return "Visual Studio";
  if (str.includes("jetbrains")) return "JetBrains";
  if (str.includes("githubcopilotchat")) return "Copilot Chat";
  if (str.includes("copilot-developer")) return "Copilot Developer";

  // Fallback: If it looks like 'unknown/SomeEditor/1.0', extract 'SomeEditor'
  const parts = editorRaw.split("/");
  if (parts[0] === "unknown" && parts.length > 1) {
    return parts[1];
  }

  // Return original if no rules match
  return editorRaw;
}
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
    .map((r) => {
      // ── Extract new data fields, defaulting to 0 if missing ────────────────
      const grossCredits = parseFloat(r.gross_credits || 0);
      const grossAmount = parseFloat(r.gross_amount || 0);
      const netCredits = parseFloat(r.net_credits || 0);
      const netAmount = parseFloat(r.net_amount || 0);
      const editor = formatEditorName(r.editor);
      const discountAmount = parseFloat(r.discount_amount || 0);
      const discountQuantity = parseFloat(r.discount_quantity || 0) * 100;

      // ── Render 10 columns matching your updated <thead> ────────────────────
      return `<tr>
        <td>
          <span class="dot ${r.activity}"></span>
          <strong>${r.name || r.user || "—"}</strong>
          ${r.unmapped ? '<span class="tag unmapped">UNMAPPED</span>' : ""}
        </td>
        <td style="color:var(--muted);font-size:12px">${r.github || "—"}</td>
        <td style="font-size:12px">${r.team || "—"}</td>
        <td>
          <span class="badge ${r.activity}">
            ${r.activity === "active" ? "Active" : "Inactive"}
          </span>
        </td>
        <td style="color:var(--muted);font-size:12px">${r.last || "—"}</td>
        <td style="font-size:11px;color:var(--muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${
          editor || ""
        }">${editor || "—"}</td>
        
        
        <td>${netCredits.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}</td>
        <td style="color:#10b981;font-weight:500;">$${netAmount.toFixed(2)}</td>

        
        </tr>`;
    })

    /**!SECTION
     * <td>${grossCredits.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}</td>
        <td style="color:#8b5cf6;font-weight:500;">$${grossAmount.toFixed(
          2
        )}</td>
     */
    .join("");
  // <td>${discountQuantity.toLocaleString(undefined, {
  //   maximumFractionDigits: 2,
  // })}</td>
  // <td style="color:#10b981;font-weight:500;">$${discountAmount.toFixed(2)}
  // </td>
}
function filterCpSearch(v) {
  cpSearchFilter = v.toLowerCase();
  filterSeats("current", null);
}
// 1. Global State for Copilot Sorting
let cpSort = { key: "netAmount", asc: false }; // Ensure this defaults to netAmount, descending
let currentCpSeats = [];

// 2. The Global Sort Function triggered by HTML onclick
window.sortCp = function (key) {
  if (cpSort.key === key) {
    cpSort.asc = !cpSort.asc;
  } else {
    cpSort.key = key;
    cpSort.asc = false;
  }
  renderCpTable(); // Redraw the table
};

// 3. The Reusable Table Render Function
function renderCpTable() {
  const tbody = document.getElementById("cp-tbody");
  if (!tbody) return;

  // ── 1. Sort the global array based on current state ──────────────────────
  const tableSeats = [...currentCpSeats].sort((a, b) => {
    // Grab the values, fallback to displayName if HTML passed 'name'
    let valA = cpSort.key === "name" ? a.displayName : a[cpSort.key];
    let valB = cpSort.key === "name" ? b.displayName : b[cpSort.key];

    // Handle Text (String) Sorting
    if (typeof valA === "string" || typeof valB === "string") {
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return cpSort.asc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    }

    // Handle Number Sorting (Credits, Amounts, cleanTimestamps)
    return cpSort.asc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
  });

  // ── 2. Render the Rows ───────────────────────────────────────────────────
  let tableHtml = "";

  tableSeats.forEach((seat) => {
    // 1. Get raw date
    const rawDate = seat.last_activity || seat.last;

    // 2. Format safely
    let lastActivityDate = "—";
    if (rawDate && rawDate !== "Never" && rawDate !== "—") {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        // Check if valid
        lastActivityDate = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    // 3. Editor (Use the global helper we built)
    let displayEditor = getCleanEditorName(seat.last_editor || seat.editor);
    // Activity Badge
    const isActive = seat.activity === "active";
    const activityBadge = isActive
      ? `<span style="background:#dcfce7;color:#166534;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:600;">Active</span>`
      : `<span style="background:#f1f5f9;color:#64748b;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:600;">Inactive</span>`;

    // 4. Build row
    tableHtml += `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px;"><strong>${seat.displayName}</strong></td>
      <td style="padding: 12px; color: #64748b;">${
        seat.user || seat.github || "—"
      }</td>
      <td style="padding: 12px;">${seat.team}</td>
      <td style="padding: 12px;">${activityBadge}</td>
      <td style="padding: 12px;">${lastActivityDate}</td>
      <td style="padding: 12px;">${displayEditor}</td>
      <td style="padding: 12px; font-weight: 500;">${seat.netCredits.toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )}</td>
      <td style="padding: 12px; color: #10b981; font-weight: 600;">$${seat.netAmount.toFixed(
        2
      )}</td>
    </tr>`;
  });

  tbody.innerHTML =
    tableHtml ||
    `<tr><td colspan="8" style="text-align:center;">No Copilot seat data available</td></tr>`;

  // ── 3. Update arrows in the UI ───────────────────────────────────────────
  const thCredit = document.getElementById("th-net-credit");
  const thAmount = document.getElementById("th-net-amount");

  if (thCredit) {
    // CHANGE 'AI CREDIT' TO MATCH YOUR NEW LABEL
    thCredit.innerHTML = `AI CREDIT ${
      cpSort.key === "netCredits" ? (cpSort.asc ? "↑" : "↓") : "↕"
    }`;
  }
  if (thAmount) {
    // CHANGE 'AMOUNT' TO MATCH YOUR NEW LABEL
    thAmount.innerHTML = `AMOUNT ${
      cpSort.key === "netAmount" ? (cpSort.asc ? "↑" : "↓") : "↕"
    }`;
  }
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

  // Helper function to clean up messy telemetry strings
  const normalizeEditorName = (raw) => {
    if (!raw || typeof raw !== "string") return "Unknown";
    const r = raw.toLowerCase();

    if (r.includes("vscode") || r.includes("visual studio code"))
      return "VS Code";
    if (r.includes("intellij")) return "IntelliJ IDEA";
    if (r.includes("visualstudio") && !r.includes("code"))
      return "Visual Studio";
    if (r.includes("neovim")) return "Neovim";
    if (r.includes("vim")) return "Vim";
    if (r.includes("jetbrains")) return "JetBrains";
    if (
      r.includes("githubcopilotchat") ||
      r.includes("copilot-developer") ||
      r.includes("copilot_pr_review")
    )
      return "Copilot Chat";

    const parts = raw.split("/");
    if (parts[0] === "unknown" && parts.length > 1) return parts[1];
    if (r.includes("unknown")) return "Unknown";

    return raw.split("/")[0].replace(/^\w/, (c) => c.toUpperCase());
  };

  // Filter to only active users, and count their editors
  const activeSeats = cpSeatsData.filter((s) => s.activity === "active");
  const editorMap = {};

  activeSeats.forEach((s) => {
    // Grab the most recent editor string available
    let rawEditor =
      s.last_editor && s.last_editor !== "—" ? s.last_editor : s.editor;

    // Pass it through our cleaner function
    let cleanEditorName = normalizeEditorName(rawEditor);

    // Group it (ignoring the unknowns for a cleaner chart)
    if (cleanEditorName !== "Unknown") {
      editorMap[cleanEditorName] = (editorMap[cleanEditorName] || 0) + 1;
    }
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
          position: "right",
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

  // 5. Stat Bar Data for Executive Summary
  set(
    "stat-total-spend",
    `$${totalSpend.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  );
  set("stat-total-members", `${clMembers.length} members in org`);
  set("stat-active-members", `${activeCount}`); // just the number, not fraction
  set("stat-inactive-members", `${inactiveCount} inactive this month`);
  set("stat-avg-active", `$${avgActive.toFixed(2)}`);
  set("stat-sum-caps", `$${totalCaps.toLocaleString()}`);
  set("stat-custom-caps", `${capsCount} custom per-person limits`);

  // 5b. Stat Bar Data for Claude Tab (with cl- prefix)
  set("cl-stat-total-spend", `$${totalSpend.toFixed(2)}`);
  set("cl-stat-total-members", `${clMembers.length} members in org`);
  set("cl-stat-active-members", `${activeCount}`);
  set("cl-stat-inactive-members", `${inactiveCount} inactive this month`);
  set("cl-stat-avg-active", `$${avgActive.toFixed(2)}`);
  set("cl-stat-sum-caps", `$${totalCaps.toLocaleString()}`);
  set("cl-stat-custom-caps", `${capsCount} custom caps`);

  // 6. Other UI updates
  set("cl-members-count", `Members (${clMembers.length})`);
  set("tab-count-cl", `${clMembers.length} members`);
}

// Global Helper: Cleans messy editor telemetry strings
function getCleanEditorName(raw) {
  if (!raw || typeof raw !== "string" || raw === "—") return "Unknown";
  const r = raw.toLowerCase();

  // Catch common editors
  if (r.includes("vscode") || r.includes("visual studio code"))
    return "VS Code";
  if (r.includes("intellij")) return "IntelliJ IDEA";
  if (r.includes("visualstudio") && !r.includes("code")) return "Visual Studio";
  if (r.includes("neovim")) return "Neovim";
  if (r.includes("vim")) return "Vim";
  if (r.includes("jetbrains")) return "JetBrains";
  if (
    r.includes("githubcopilotchat") ||
    r.includes("copilot-developer") ||
    r.includes("copilot_pr_review")
  )
    return "Copilot Chat";

  // Fallback: If it says "unknown/EditorName/1.0", extract "EditorName"
  const parts = raw.split("/");
  if (parts[0] === "unknown" && parts.length > 1) return parts[1];

  if (r.includes("unknown")) return "Unknown";

  // Final Fallback: capitalize the first segment
  return raw.split("/")[0].replace(/^\w/, (c) => c.toUpperCase());
}
function updateCopilotDashboard(cpRows, cpSeatsData) {
  if (!cpSeatsData || cpSeatsData.length === 0) return;
  if (!cpRows) cpRows = [];

  // ============ DEBUG START ============
  console.log("=== updateCopilotDashboard DEBUG ===");
  console.log("cpSeatsData count:", cpSeatsData[0]);
  console.log("cpRows count:", cpRows[0]);

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // --- 1. SEAT DATA CALCULATIONS (Now using NET AMOUNT) ---
  const activeSeats = cpSeatsData.filter((s) => s.activity === "active");
  const inactive = cpSeatsData.filter((s) => s.activity === "inactive");

  const monthlyCost = cpSeatsData.reduce(
    (sum, s) => sum + parseFloat(s.net_amount || 0),
    0
  );

  const reclaimableCost = inactive.reduce(
    (sum, s) => sum + parseFloat(s.net_amount || 0),
    0
  );

  const neverUsedCount = cpSeatsData.filter(
    (s) => s.last === "Never" || parseFloat(s.net_amount || 0) === 0
  ).length;

  // --- 2. MAP USERS TO EDITORS (Fixed Logic) ---
  const normalizeEditor = (raw) => {
    if (!raw || typeof raw !== "string") return "Unknown";
    const r = raw.toLowerCase();

    // Catch the messy telemetry strings properly
    if (r.includes("vscode") || r.includes("visual studio code"))
      return "VS Code";
    if (r.includes("intellij")) return "IntelliJ IDEA";
    if (r.includes("visualstudio") && !r.includes("code"))
      return "Visual Studio";
    if (r.includes("neovim")) return "Neovim";
    if (r.includes("vim")) return "Vim";
    if (r.includes("jetbrains")) return "JetBrains";
    if (
      r.includes("githubcopilotchat") ||
      r.includes("copilot-developer") ||
      r.includes("copilot_pr_review")
    )
      return "Copilot Chat";

    // If it says "unknown/EditorName/1.0", extract "EditorName"
    const parts = raw.split("/");
    if (parts[0] === "unknown" && parts.length > 1) {
      return parts[1];
    }

    if (r.includes("unknown")) return "Unknown";

    // Fallback: capitalize first segment
    return raw.split("/")[0].replace(/^\w/, (c) => c.toUpperCase());
  };

  const userToEditorMap = {};
  cpSeatsData.forEach((s) => {
    if (s.user && (s.last_editor || s.editor)) {
      const normalized = normalizeEditor(s.last_editor || s.editor); // <-- UPDATED HERE
      if (normalized !== "Unknown") {
        userToEditorMap[s.user] = normalized;
      }
    }
  });

  // --- 3. ROW DATA CALCULATIONS (Usage & Interactions) ---
  let langStats = {};
  let editorStats = {};
  let teamAcceptanceStats = {};
  let totalLinesAccepted = 0;
  let activeUsersSet = new Set();
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

      // Dominant Editor
      let editor =
        userToEditorMap[r.user] || normalizeEditor(r.last_editor || r.editor); // <-- UPDATED HERE

      if (activity > 0) {
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

  // If cpRows had no editor data, build editorStats directly from seat data safely
  let isSeatFallback = false;
  if (Object.keys(editorStats).length === 0 && cpSeatsData.length > 0) {
    isSeatFallback = true;
    cpSeatsData.forEach((s) => {
      const editor = normalizeEditor(s.last_editor || s.editor);
      if (editor !== "Unknown") {
        editorStats[editor] = (editorStats[editor] || 0) + 1; // Tallies by users instead of events
      }
    });
  }

  // --- 4. SORTING AND AGGREGATING WINNERS ---
  const sortedLangs = Object.entries(langStats).sort((a, b) => b[1] - a[1]);

  const finalSortedEditors = Object.entries(editorStats)
    .filter(([name]) => name !== "—" && name !== "Unknown")
    .sort((a, b) => b[1] - a[1]);

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

  if (finalSortedEditors.length > 0) {
    set("dom-editor-val", finalSortedEditors[0][0]);
    // If we used the fallback, it means we counted users, not events
    const subLabel = isSeatFallback ? "active users" : "events";
    set(
      "dom-editor-sub",
      `${finalSortedEditors[0][1].toLocaleString()} ${subLabel}`
    );
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

  // NEW: Stat bar (Total / Active / Inactive / Spend)
  const unmappedCount = cpSeatsData.filter((s) => s.unmapped).length;

  set("cpd-total-seats", cpSeatsData.length);
  set("cpd-unmapped-sub", `${unmappedCount} unmapped`);

  set("cpd-active-seats", activeSeats.length);

  set("cpd-inactive-seats", inactive.length);
  set("cpd-inactive-cost", `Costing $${reclaimableCost.toLocaleString()}`);

  set("cpd-monthly-cost", `$${monthlyCost.toLocaleString()}`);
  set(
    "cpd-annual-cost",
    `$${Math.round(monthlyCost * 12).toLocaleString()} / yr`
  );

  // const tabBadge = document.getElementById("tab-count-cp");
  // if (tabBadge) tabBadge.textContent = `${cpSeatsData.length} seats`;

  const tabBadge = document.getElementById("tab-count-cp");
  if (tabBadge) tabBadge.textContent = `${cpSeatsData.length} seats`;

  // --- 6. RENDER ALL CHARTS ---
  const drawChart = (canvasId, config) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (window[canvasId + "Instance"]) window[canvasId + "Instance"].destroy();
    window[canvasId + "Instance"] = new Chart(ctx, config);
  };

  // Top Languages Chart
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
              "#0ea5e9",
              "#14b8a6",
              "#f97316",
              "#84cc16",
              "#a855f7",
              "#eab308",
              "#f43f5e",
              "#06b6d4",
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

  // Active Editors Chart
  if (finalSortedEditors.length > 0) {
    drawChart("cpEditorChart", {
      type: "doughnut",
      data: {
        labels: finalSortedEditors.map((item) => item[0]),
        datasets: [
          {
            data: finalSortedEditors.map((item) => item[1]),
            backgroundColor: [
              "#059669",
              "#d97706",
              "#2563eb",
              "#7c3aed",
              "#db2777",
              "#475569",
              "#0ea5e9",
            ],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
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

  // Daily Trend Charts
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

// Keep a reference to the chart instance
let spendChartInstance = null;

function renderUserSpendChart(cpSeatsData, orgAiCredits) {
  // 1. Data Check
  if (!cpSeatsData || cpSeatsData.length === 0) {
    console.error(
      "❌ DEBUG FAIL: cpSeatsData is completely empty or undefined!"
    );
    return;
  }

  try {
    // 2. Math Check (Total User Spend)
    const calculatedTotalSpend = cpSeatsData.reduce((sum, seat) => {
      return sum + parseFloat(seat.net_amount || 0);
    }, 0);

    // 3. FIX: Aggressive Budget Check
    // If the whole payload was passed by accident, extract org_ai_credits
    let safeOrgData = orgAiCredits;
    if (orgAiCredits && orgAiCredits.org_ai_credits) {
      safeOrgData = orgAiCredits.org_ai_credits;
    }
    const budget = safeOrgData ? safeOrgData.budget_usd || 0 : 0;
    console.log("DEBUG: Extracted Budget:", budget);

    // 4. Subtitle DOM Check
    const cardSub = document.getElementById("org-spend-subtitle");
    if (cardSub) {
      let subHtml = `<strong>Total User Spend:</strong> $${calculatedTotalSpend.toFixed(
        2
      )}`;

      // Even if budget is 0, we'll print it out for debugging purposes now
      if (budget > 0) {
        subHtml += ` <span style="color:#94a3b8; font-weight:normal;">/ $${budget.toLocaleString()} Org Budget</span>`;
      } else {
        subHtml += ` <span style="color:#ef4444; font-weight:normal; font-size:11px;">(Budget data missing from API)</span>`;
      }

      cardSub.innerHTML = subHtml;
      cardSub.style.color = "#334155";
      cardSub.style.fontSize = "13px";
      cardSub.style.marginBottom = "10px";
    }

    // 5. Sorting Check
    const topUsers = [...cpSeatsData]
      .sort(
        (a, b) => parseFloat(b.net_amount || 0) - parseFloat(a.net_amount || 0)
      )
      .slice(0, 10);

    const labels = topUsers.map((seat) => seat.user || seat.name || "Unknown");
    const dataPoints = topUsers.map((seat) => parseFloat(seat.net_amount || 0));

    // 6. Canvas Check
    const canvasEl = document.getElementById("orgSpendChart");
    if (!canvasEl) return;

    if (typeof Chart === "undefined") return;

    // Destroy old chart if it exists
    if (spendChartInstance) {
      spendChartInstance.destroy();
    }

    // 7. Array of colors for the Doughnut slices
    const sliceColors = [
      "#8b5cf6", // Purple
      "#10b981", // Green
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#3b82f6", // Blue
      "#ec4899", // Pink
      "#14b8a6", // Teal
      "#f97316", // Orange
      "#6366f1", // Indigo
      "#84cc16", // Lime
    ];

    // 8. Draw Circle Chart
    spendChartInstance = new Chart(canvasEl, {
      type: "doughnut", // Changed to doughnut (circle)
      data: {
        labels: labels,
        datasets: [
          {
            label: "User Spend ($)",
            data: dataPoints,
            backgroundColor: sliceColors, // Array of colors applied here
            borderWidth: 2,
            hoverOffset: 4, // Makes the slice pop out when hovered
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // Moved legend to the right side so it fits nicely next to the circle
          legend: {
            display: true,
            position: "right",
            labels: {
              boxWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                // Formatting tooltip to show "Name: $123.45"
                const label = context.label || "";
                const val = context.parsed || 0;
                return ` ${label}: $${val.toFixed(2)}`;
              },
            },
          },
        },
        // IMPORTANT: Scales (x and y axes) are completely removed. Circle charts break if you include them!
        cutout: "65%", // Adjusts how thick the doughnut ring is
      },
    });
  } catch (error) {
    console.error(
      "❌ DEBUG CRITICAL ERROR inside renderUserSpendChart:",
      error
    );
  }
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

  const topLangs = Object.keys(langStats)
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
// ── 1. ROBUST Normalizer (With Safe Date Parsing) ────────────────────────
const normalizedSeats = cpSeatsData
  .map((s) => {
    // Safely parse credits and amounts
    const cleanCredits =
      typeof s.net_credits === "string"
        ? parseFloat(s.net_credits.replace(/[^0-9.-]+/g, ""))
        : parseFloat(s.net_credits || 0);

    const cleanAmount =
      typeof s.net_amount === "string"
        ? parseFloat(s.net_amount.replace(/[^0-9.-]+/g, ""))
        : parseFloat(s.net_amount || 0);

    // SAFELY parse the date to prevent "Invalid Date" errors
    const rawDate = s.last_activity || s.last;
    let timestamp = 0;

    if (rawDate && rawDate !== "Never" && rawDate !== "—") {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        timestamp = parsedDate.getTime();
      }
    }

    const finalEditor =
      typeof getCleanEditorName === "function"
        ? getCleanEditorName(s.last_editor || s.editor)
        : s.last_editor || s.editor || "—";

    // We MUST return these exact keys so renderCpTable can see them!
    return {
      ...s,
      netCredits: cleanCredits,
      netAmount: cleanAmount,
      displayName: s.user || s.name || "Unknown User",
      team: s.team || "—",
      cleanTimestamp: timestamp, // <-- This generates the dates!
      cleanEditor: finalEditor, // <-- This generates the clean editor names!
      rawDate: rawDate, // <-- This checks if they are active!
    };
  })
  .sort((a, b) => b.netAmount - a.netAmount);

// ── Tokens by Model donut ──────────────────────────────
function updateCopilotTokenWarnings(cpSeatsData, orgAiCredits) {
  if (!cpSeatsData || cpSeatsData.length === 0) return;

  const criticalContainer = document.getElementById("critical-dollars-list");

  // ── Normalise seats ──────────────────────────────────────────────────────
  const normalizedSeats = cpSeatsData.map((s) => {
    return {
      ...s,
      netCredits: parseFloat(s?.net_credits || 0),
      netAmount: parseFloat(s?.net_amount || 0),
      displayName: s.user || s.name || "Unknown User",
      team: s.team || "—",
    };
  });

  // Save the normalized data to our global variable so sortCp() can use it!
  currentCpSeats = normalizedSeats;

  // ── Render Sidebar (Always sorted by highest Net Amount) ─────────────────
  if (criticalContainer) {
    const sidebarSeats = [...normalizedSeats].sort(
      (a, b) => b.netAmount - a.netAmount
    );
    let listHtml = "";

    const APPROACHING_THRESHOLD_USD = 50;
    const CRITICAL_THRESHOLD_USD = 200;

    sidebarSeats.forEach((seat) => {
      if (seat.netAmount < APPROACHING_THRESHOLD_USD) return;

      const isCritical = seat.netAmount >= CRITICAL_THRESHOLD_USD;
      const color = "#d97706";
      // const color = isCritical ? "#ef4444" : "#f59e0b";

      listHtml += `
        <div class="reclaim-item">
          <div>
            <div class="ri-name">${seat.displayName}</div>
            <div class="ri-sub">${seat.netCredits.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })} ai credits</div>
          </div>
          <span class="ri-cost" style="color: ${color};">$${seat.netAmount.toFixed(
        2
      )}</span>
        </div>`;
    });

    criticalContainer.innerHTML =
      listHtml ||
      `<div style="padding:10px;text-align:center;color:#94a3b8;font-size:12px;">No users with high spend</div>`;
  }

  // ── Trigger the initial table render ─────────────────────────────────────
  renderCpTable();

  // ── Org-level summary cards ──────────────────────────────────────────────
  if (orgAiCredits) {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setEl(
      "org-budget-usd",
      `$${(orgAiCredits.budget_usd || 0).toLocaleString()}`
    );
    setEl(
      "org-credits-used",
      (orgAiCredits.gross_credits_used || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    );
    setEl(
      "org-net-billed",
      `$${(orgAiCredits.net_amount_usd || 0).toFixed(2)}`
    );
    setEl(
      "org-utilization-pct",
      `${(orgAiCredits.utilization_pct || 0).toFixed(2)}%`
    );
  }
}
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
function sortWisprUsersByRole(users) {
  if (!users || !Array.isArray(users)) return users;
  const roleOrder = { Admin: 0, Member: 1, Viewer: 2, Billing: 3 };
  return [...users].sort((a, b) => {
    const roleA = a.role || "Member";
    const roleB = b.role || "Member";
    return (roleOrder[roleA] ?? 99) - (roleOrder[roleB] ?? 99);
  });
}
function renderWisprUsers(wisprUsers) {
  console.log("🔍 renderWisprUsers called with:", wisprUsers);

  const container = document.getElementById("wispr-user-list");
  if (!container) {
    console.error("❌ Container #wispr-user-list not found.");
    return;
  }

  if (!wisprUsers) {
    container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-6">No Wispr users data</div>`;
    return;
  }

  if (!Array.isArray(wisprUsers)) {
    if (wisprUsers.users && Array.isArray(wisprUsers.users)) {
      wisprUsers = wisprUsers.users;
    } else {
      container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-6">Invalid Wispr users data</div>`;
      return;
    }
  }

  if (wisprUsers.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center text-gray-400 py-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
        No Wispr users found
      </div>
    `;
    return;
  }

  try {
    let html = "";
    wisprUsers.forEach((user, index) => {
      // Safe data
      const safeName = user?.name || "Unknown";
      const safeEmail = user?.email || "";
      const safeRole = user?.role || "Member";
      let displayStatus = user?.status || "—";

      // Normalize status
      const statusLower = displayStatus.toLowerCase();
      if (statusLower === "trialing") displayStatus = "Trialing";
      else if (statusLower === "active") displayStatus = "Active";
      else if (statusLower === "inactive") displayStatus = "Inactive";

      // Badge colors
      let statusColor = "text-gray-600";
      let statusBg = "bg-gray-100";
      if (displayStatus.includes("Active")) {
        statusColor = "text-green-700";
        statusBg = "bg-green-100";
      } else if (displayStatus.includes("Trialing")) {
        statusColor = "text-amber-700";
        statusBg = "bg-amber-100";
      } else if (displayStatus.includes("Inactive")) {
        statusColor = "text-red-700";
        statusBg = "bg-red-100";
      }

      // ---- Avatar logic ----
      const nameEncoded = encodeURIComponent(safeName);
      // Get initials (max 2 characters)
      const initials = safeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      // Check if we have a valid image URL
      let avatarUrl = user?.image_url || user?.avatar || "";
      const isValidHttp = avatarUrl.match(/^https?:\/\//);
      const useImage = isValidHttp;

      // Build avatar HTML (either <img> or a placeholder div)
      let avatarHtml = "";
      if (useImage) {
        avatarHtml = `
          <img
            src="${avatarUrl}"
            alt="${safeName}"
            class="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
            loading="lazy"
            onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="w-8 h-8 rounded-full bg-[#009A2F] text-white text-xs font-bold flex items-center justify-center border border-gray-200 flex-shrink-0" style="display:none;">
            ${initials}
          </div>
        `;
      } else {
        avatarHtml = `
          <div class="w-8 h-8 rounded-full bg-[#009A2F] text-white text-xs font-bold flex items-center justify-center border border-gray-200 flex-shrink-0">
            ${initials}
          </div>
        `;
      }

      const uniqueId = `wispr-user-${index}`;

      html += `
        <div id="${uniqueId}" 
             class="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 w-full min-w-[200px]">
          
          <!-- Left: Avatar + Name/Email -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative flex-shrink-0">
              ${avatarHtml}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-semibold text-gray-800 truncate">${safeName}</div>
              <div class="text-[11px] text-gray-500 truncate">${safeEmail}</div>
            </div>
          </div>

          <!-- Right: Status + Role -->
          <div class="flex items-center gap-2 flex-shrink-0 ml-2">
            <span class="${statusBg} ${statusColor} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
              ${displayStatus}
            </span>
            <span class="text-[11px] text-gray-600 font-medium bg-gray-50 px-2 py-0.5 rounded border border-gray-200 whitespace-nowrap">
              ${safeRole}
            </span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    console.log("✅ Wispr users rendered successfully.");
  } catch (error) {
    console.error("❌ Error rendering Wispr users:", error);
    container.innerHTML = `
      <div class="col-span-full text-center text-red-500 py-6 bg-red-50 border border-red-200 rounded-lg">
        Error loading Wispr users. Check console.
      </div>
    `;
  }
}
function loadCachedDashboard() {
  const cached = localStorage.getItem("dashboardCache");

  if (cached) {
    try {
      const data = JSON.parse(cached);
      console.log("📦 Loaded cached data from localStorage (No API call)");

      // Restore all your global mapped variables
      clMembers = data.clMembers || [];
      cpSeatsData = data.cpSeatsData || [];
      clModelData = data.clModelData || { labels: [], values: [] };
      clTeamSpend = data.clTeamSpend || [];
      topTotal = data.topTotal || [];
      topToday = data.topToday || [];

      // Re-render everything using the cached data
      if (clMembers.length) {
        updateClaudeDashboard(clMembers);
        updateTokenWarnings(clMembers);
      }
      if (cpSeatsData.length) {
        updateCopilotHeroBar(cpSeatsData);
        updateSavingsBanner(cpSeatsData);
        // You'll need to pass the cached payload.org_ai_credits too if you saved it
        updateCopilotTokenWarnings(cpSeatsData, data.orgAiCredits || {});
      }

      renderClaude();
      renderCopilot();
      renderClModelChart(data.rawClaude || []);
      renderUserSpendChart(cpSeatsData, data.orgAiCredits || {});
      renderExecutiveCharts(clMembers, cpSeatsData);

      // If you saved Wispr data
      if (data.wispr) {
        renderWisprFlow(data.wispr);
        renderWisprUsers(sortWisprUsersByRole(data.wispr.users));
      }

      return true; // Cache was found
    } catch (e) {
      console.warn("Cache corrupted, clearing it.", e);
      localStorage.removeItem("dashboardCache");
    }
  }
  return false; // No cache found
}
// The function now accepts the data object dynamically
function initWisprChart(wisprData) {
  if (!wisprData || !wisprData.daily || !wisprData.weekly) {
    console.error("Cannot initialize chart: Invalid or missing wisprData.");
    return;
  }

  const canvas = document.getElementById("wisprWordsChart");
  if (!canvas) return;

  // --- CHART LOGIC ---
  const processChartData = (viewType) => {
    const dataSet = wisprData[viewType];
    return {
      labels: dataSet.map((d) =>
        new Date(d.period).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      desktop: dataSet.map((d) => d.desktop),
      mobile: dataSet.map((d) => d.mobile),
    };
  };

  const initialData = processChartData("weekly");
  const ctx = canvas.getContext("2d");

  if (window.wisprChartInstance) {
    window.wisprChartInstance.destroy();
  }

  window.wisprChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: initialData.labels,
      datasets: [
        {
          label: "Desktop",
          data: initialData.desktop,
          borderColor: "#115e59",
          backgroundColor: "rgba(17, 94, 89, 0.04)", // Elegant super-light gradient area tint
          borderWidth: 2,
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: "Mobile",
          data: initialData.mobile,
          borderColor: "#ea580c",
          backgroundColor: "rgba(234, 88, 12, 0.04)",
          borderWidth: 2,
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 6, font: { weight: "500" } },
        },
        tooltip: {
          padding: 12,
          backgroundColor: "#ffffff",
          titleColor: "#111827",
          bodyColor: "#4b5563",
          borderColor: "#f3f4f6",
          borderWidth: 1,
          shadowColor: "rgba(0,0,0,0.1)",
          boxPadding: 6,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#9ca3af", font: { size: 11 } },
        },
        y: {
          grid: { color: "#f9fafb" },
          border: { display: false },
          ticks: {
            color: "#9ca3af",
            font: { size: 11 },
            callback: (value) => (value >= 1000 ? value / 1000 + "k" : value),
          },
          beginAtZero: true,
        },
      },
    },
  });

  // --- PREMIUM MENU COMPONENT CUSTOM INTERACTION ---
  const dropdownBtn = document.getElementById("wisprCustomDropdownBtn");
  const customMenu = document.getElementById("wisprCustomMenu");
  const chevronIcon = document.getElementById("wisprChevronIcon");
  const selectedText = document.getElementById("wisprSelectedValue");
  const optionButtons = document.querySelectorAll(".wispr-option");
  const checkIcons = document.querySelectorAll(".wispr-check");

  function openDropdown() {
    customMenu.classList.remove("scale-95", "opacity-0", "pointer-events-none");
    customMenu.classList.add("scale-100", "opacity-100");
    chevronIcon.classList.add("rotate-180");
  }

  function closeDropdown() {
    customMenu.classList.add("scale-95", "opacity-0", "pointer-events-none");
    customMenu.classList.remove("scale-100", "opacity-100");
    chevronIcon.classList.remove("rotate-180");
  }

  // Toggle dropdown state on main menu click
  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpened = customMenu.classList.contains("scale-100");
    isOpened ? closeDropdown() : openDropdown();
  });

  // Handle menu list item clicks
  optionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = btn.getAttribute("data-value");

      // Update custom layout texts
      selectedText.textContent =
        value === "weekly" ? "Weekly view" : "Daily view";

      // Visibility transformations for the custom checkmarks
      checkIcons.forEach((icon) => icon.classList.add("hidden"));
      document.getElementById(`check-${value}`).classList.remove("hidden");

      // Refresh Chart.js with the selected granularity context
      const newData = processChartData(value);
      window.wisprChartInstance.data.labels = newData.labels;
      window.wisprChartInstance.data.datasets[0].data = newData.desktop;
      window.wisprChartInstance.data.datasets[1].data = newData.mobile;
      window.wisprChartInstance.update();

      closeDropdown();
    });
  });

  // Dismiss dropdown menu cleanly if clicking anywhere else outside of the toggle container
  document.addEventListener("click", closeDropdown);
}
async function fetchRealTimeDashboardData() {
  const refreshBtn = document.getElementById("refresh-icon");
  try {
    // 1. Change to Loading
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = "Loading...";
    console.log("Loading Data...");
    const response = await fetch("/api/dashboard-data");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const payload = await response.json();
    console.log("Data loaded successfully");

    if (!payload.copilot_seats || payload.copilot_seats.length === 0) {
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
      if (payload.claude && payload.claude.length > 0) {
        const modelMap = {};
        payload.claude.forEach((log) => {
          const modelName = log.model || "Unknown Model";
          modelMap[modelName] =
            (modelMap[modelName] || 0) + (log.tokens || log.cost || 1);
        });

        clModelData = {
          labels: Object.keys(modelMap),
          values: Object.values(modelMap),
        };
        console.log("Mapped Model Data:", clModelData);
      } else {
        // Fallback demo data if payload.claude is empty
        clModelData = {
          labels: ["Claude 3.5 Sonnet", "Claude 3 Opus", "Claude 3 Haiku"],
          values: [450, 120, 300],
        };
      }
      // REMOVED duplicate renderClaude() from here
    }

    // --- Copilot Mapping ---
    if (payload.copilot_seats) {
      cpSeatsData = payload.copilot_seats.map((s) => ({
        name: s.user,
        user: s.user,
        github: s.user,
        team: s.team || "Unassigned",
        activity: s.last_activity ? "active" : "inactive",
        last: s.last_activity || "Never",
        last_editor: s.last_editor || "",
        editor: s.last_editor || "—",
        cost: s.spend_usd || 0,
        lines_accepted: s.lines_accepted || 0,
        unmapped: false,
        gross_credits: s.gross_credits,
        gross_amount: s.gross_amount,
        net_credits: s.net_credits,
        net_amount: s.net_amount,
        discount_amount: s.discount_amount,
        spend_usd: s.spend_usd || 0,
        limit_usd: s.limit_usd || 0,
        remaining_usd: s.remaining_usd || 0,
      }));
      // REMOVED duplicate renderCopilot() from here
    }
    if (payload.wispr) {
      console.log(`wispr : ${JSON.stringify(payload.wispr)}`);

      renderWisprFlow(payload.wispr);
      const sortedUsers = sortWisprUsersByRole(payload?.wispr.users);
      renderWisprUsers(sortedUsers);
      initWisprChart(payload.wispr);
      // renderWisprFlow(wisprflow); // !!! Temporary - for testing
    }
    if (typeof clMembers !== "undefined") {
      // 1. Update the UI Stats (Dashboard Cards)
      updateClaudeDashboard(clMembers);
      updateTokenWarnings(clMembers);
    }

    if (typeof cpSeatsData !== "undefined") {
      updateCopilotHeroBar(cpSeatsData);
      updateSavingsBanner(cpSeatsData);
      updateCopilotDashboard(payload.copilot, cpSeatsData);

      // FIXED: Added payload.org_ai_credits so your summary cards update!
      updateCopilotTokenWarnings(cpSeatsData, payload.org_ai_credits);
    }

    // 2. Render Charts (Final step, done only once)
    renderClaude();
    renderCopilot();
    renderClModelChart(payload.claude);

    // FIXED: Renamed to match the User Bar Chart we just created!
    renderUserSpendChart(cpSeatsData, payload?.org_ai_credits);
    console.log(`org_ai_credits`, payload);
    renderExecutiveCharts(clMembers, cpSeatsData);

    // 3. Trigger the "All" view to populate the Table and Stats automatically
    // filterSeats("all", null);
  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    if (typeof showErrorState === "function") showErrorState("dashboard");
  } finally {
    // if (refreshBtn) refreshBtn.textContent = "🔄"; // Change back to arrows
    refreshBtn.disabled = false;
    refreshBtn.innerHTML =
      '<i class="your-original-icon-class"></i> Refresh Data';
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
      plugins: {
        legend: { display: false },
        // 1. FIX THE TOOLTIP HOVER (This fixes the "198.958" issue for Today's chart)
        tooltip: {
          callbacks: {
            label: function (context) {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(context.raw || 0);
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            // 2. FIX THE AXIS LABELS (Clean $100, $200 format)
            callback: function (value) {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(value);
            },
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
      plugins: {
        legend: { display: false },
        // 1. FIX THE TOOLTIP HOVER (This fixes the "198.958" issue)
        tooltip: {
          callbacks: {
            label: function (context) {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(context.raw || 0);
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#8a8a9a",
            font: { size: 10 },
            // 2. FIX THE AXIS LABELS
            callback: function (value) {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0, // Optional: Keeps the axis labels clean by hiding the .00
              }).format(value);
            },
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
  // Load cache on page load
  const hasCache = loadCachedDashboard();
  if (!hasCache) fetchRealTimeDashboardData();

  // Bind the refresh button purely in JS
  document
    .getElementById("refresh-btn")
    .addEventListener("click", fetchRealTimeDashboardData);
});
