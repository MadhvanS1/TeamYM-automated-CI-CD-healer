import { CheckCircle2, XCircle, Clock, Zap, AlertTriangle, Bug, ShieldAlert, Gauge, Code, Scan, GitPullRequest, Loader2 } from "lucide-react";

const statusConfig = {
  // Scan statuses
  pending: { label: "Pending", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: Clock },
  scanning: { label: "Scanning", classes: "bg-purple-500/15 text-purple-400 border-purple-500/20 animate-pulse", icon: Scan },
  completed: { label: "Completed", classes: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
  failed: { label: "Failed", classes: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
  // Issue statuses
  open: { label: "Open", classes: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Bug },
  fixing: { label: "Fixing", classes: "bg-purple-500/15 text-purple-400 border-purple-500/20 animate-pulse", icon: Zap },
  fixed: { label: "Fixed", classes: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
  fix_failed: { label: "Fix Failed", classes: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
  creating_pr: { label: "Creating PR", classes: "bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse", icon: GitPullRequest },
  pr_created: { label: "PR Created", classes: "bg-green-500/15 text-green-400 border-green-500/20", icon: GitPullRequest },
  pr_failed: { label: "PR Failed", classes: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
  // Severity levels
  critical: { label: "Critical", classes: "bg-red-500/15 text-red-400 border-red-500/20", icon: AlertTriangle },
  high: { label: "High", classes: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: ShieldAlert },
  medium: { label: "Medium", classes: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Gauge },
  low: { label: "Low", classes: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Code },
  // PR statuses
  merged: { label: "Merged", classes: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: CheckCircle2 },
  closed: { label: "Closed", classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: XCircle },
};

export default function StatusBadge({ status, size = "default" }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1 rounded-sm border font-semibold whitespace-nowrap ${config.classes} ${sizeClasses}`}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {config.label}
    </span>
  );
}
