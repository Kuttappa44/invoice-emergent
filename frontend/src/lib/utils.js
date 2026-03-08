import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(num) {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatPercentage(num) {
  if (num === undefined || num === null) return "0%";
  return `${num.toFixed(1)}%`;
}

export function getStatusColor(status) {
  const colors = {
    matched: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    partial_match: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    no_match: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    flagged: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return colors[status] || colors.pending;
}

export function getConfidenceLevel(score) {
  if (score >= 0.8) return { level: "high", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 0.5) return { level: "medium", color: "text-amber-600 dark:text-amber-400" };
  return { level: "low", color: "text-red-600 dark:text-red-400" };
}

export function truncateText(text, maxLength = 50) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
