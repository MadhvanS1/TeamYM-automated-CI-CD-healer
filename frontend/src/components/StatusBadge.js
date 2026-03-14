import { CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from "lucide-react";

const statusConfig = {
  success: {
    label: "Success",
    classes: "bg-green-500/15 text-green-400 border-green-500/20",
    icon: CheckCircle2,
  },
  failure: {
    label: "Failed",
    classes: "bg-red-500/15 text-red-400 border-red-500/20",
    icon: XCircle,
  },
  healed: {
    label: "Healed",
    classes: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    icon: Zap,
  },
  completed: {
    label: "Completed",
    classes: "bg-green-500/15 text-green-400 border-green-500/20",
    icon: CheckCircle2,
  },
  analyzing: {
    label: "Analyzing",
    classes: "bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse",
    icon: Clock,
  },
  generating_fix: {
    label: "Generating Fix",
    classes: "bg-purple-500/15 text-purple-400 border-purple-500/20 animate-pulse",
    icon: Zap,
  },
  creating_pr: {
    label: "Creating PR",
    classes: "bg-blue-500/15 text-blue-400 border-blue-500/20 animate-pulse",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    classes: "bg-red-500/15 text-red-400 border-red-500/20",
    icon: AlertTriangle,
  },
  pending: {
    label: "Pending",
    classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
    icon: Clock,
  },
};

export default function StatusBadge({ status, size = "default" }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1 rounded-sm border font-semibold ${config.classes} ${sizeClasses}`}
    >
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {config.label}
    </span>
  );
}
