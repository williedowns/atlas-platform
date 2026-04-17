/**
 * Master Spas white-label branding for the manufacturer portal demo.
 * Shown to Master Spas leadership at end-of-2026 dealer meeting.
 */

export const MS_BRAND = {
  companyName: "Master Spas",
  productName: "Master Spas Dealer Network",
  tagline: "Real-Time Network Operating System",
  poweredBy: "Powered by Salta",

  colors: {
    headerBg: "#0B1929",
    headerText: "#FFFFFF",
    primary: "#DC2626",
    primaryHover: "#B91C1C",
    accent: "#0891B2",
    accentHover: "#0E7490",
    success: "#059669",
    warning: "#D97706",
    danger: "#DC2626",
    sidebarBg: "#0F2038",
    sidebarBorder: "#1E3353",
    cardBg: "#FFFFFF",
    pageBg: "#F1F5F9",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
  },

  chartColors: [
    "#DC2626",
    "#0891B2",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#DB2777",
    "#0EA5E9",
    "#84CC16",
  ],

  modelLineColors: {
    "Michael Phelps Legend": "#DC2626",
    "Twilight": "#0891B2",
    "Clarity": "#059669",
    "H2X Fitness": "#7C3AED",
    "MP Signature Swim Spa": "#D97706",
  },
} as const;

export type MSBrand = typeof MS_BRAND;
