// Centralized dictionary of CSS classes
// export const WISPR_URLS = {
//   login: "https://wisprflow.ai/login", // Replace with exact login URL
//   usage: "https://wisprflow.ai/admin/usage",
//   team: "https://wisprflow.ai/admin/team",
// };
// export const WISPR_URLS = {
//   login: "https://admin.wisprflow.ai/login",
//   usage: "https://admin.wisprflow.ai/app/usage", // or wherever usage actually lives — see below
//   team: "https://admin.wisprflow.ai/app/team",
// };
// export const WISPR_SELECTORS = {
//   login: {
//     // Targets the input specifically by its name attribute
//     emailInput: 'input[name="email"]',

//     // Targets the password input by its name attribute
//     passwordInput: 'input[name="password"]',

//     // Targets the button specifically by its submit type attribute
//     submitButton: 'button[type="submit"]',
//   },
//   usage: {
//     wordsDictated: ".words-dictated-class", // TODO: Update after inspecting DOM
//     trend: ".trend-class", // TODO: Update after inspecting DOM
//   },
//   team: {
//     summary: ".team-summary-class", // TODO: Update after inspecting DOM
//     paidSeats: ".paid-seats-class", // TODO: Update after inspecting DOM
//   },
// };
export const WISPR_URLS = {
  login: "https://admin.wisprflow.ai/login",
  usage: "https://admin.wisprflow.ai/app/usage",
  team: "https://admin.wisprflow.ai/app/team",
};

export const WISPR_SELECTORS = {
  login: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    // continueButton not needed — debug dump confirmed email+password fields
    // are both present on the same page, no multi-step flow here.
  },
  usage: {
    wordsDictated: '[data-slot="card-title"]',
    trend: "svg.lucide-trending-up + span",
  },
  team: {
    summary: '[class*="_headerText_"]',
    bucketCount: '[class*="_count_"]',
    bucketLabel: '[class*="_label_"]',
  },
};
