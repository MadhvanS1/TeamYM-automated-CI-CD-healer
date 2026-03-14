import { useState, useEffect } from "react";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Zap, CheckCircle2, XCircle, Clock, GitBranch,
  ExternalLink, AlertTriangle, Sparkles
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function HealingHistoryPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await axios.get(`${API}/healing-attempts`);
        setAttempts(res.data);
      } catch {
        toast.error("Failed to load healing history");
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const statusIcon = (status) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-400" />;
      case "analyzing":
      case "generating_fix":
      case "creating_pr":
        return <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />;
      default: return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <div className="mb-6">
        <h1 data-testid="healing-history-title" className="text-2xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
          Healing History
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{attempts.length} healing attempts</p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-12 text-center">
          <Sparkles className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No healing attempts yet</p>
          <p className="text-zinc-600 text-xs mt-1">Trigger a heal from a failed pipeline run</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt, idx) => (
            <motion.div
              key={attempt.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors"
            >
              <div
                data-testid={`healing-attempt-${attempt.id}`}
                onClick={() => setExpanded(expanded === attempt.id ? null : attempt.id)}
                className="px-5 py-4 cursor-pointer flex items-center gap-4"
              >
                {statusIcon(attempt.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200 font-medium truncate">{attempt.repo}</span>
                    <StatusBadge status={attempt.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
                    <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {attempt.branch}</span>
                    <span>SHA: {attempt.commit_sha?.slice(0, 7)}</span>
                    <span>{formatDate(attempt.created_at)}</span>
                  </div>
                </div>
                {attempt.pr_url && (
                  <a
                    href={attempt.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`healing-pr-link-${attempt.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-xs text-purple-400 hover:bg-purple-500/15 transition-all flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> PR
                  </a>
                )}
              </div>

              {expanded === attempt.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="border-t border-zinc-800/60"
                >
                  {/* Timeline */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-4">
                      {attempt.steps?.map((step, i) => (
                        <div key={i} className="flex items-center gap-2" data-testid={`heal-timeline-step-${i}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            step.status === "completed"
                              ? "bg-green-500/15 text-green-400"
                              : step.status === "in_progress"
                              ? "bg-purple-500/15 text-purple-400"
                              : "bg-zinc-800/50 text-zinc-600"
                          }`}>
                            {step.status === "completed" ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : step.status === "in_progress" ? (
                              <Zap className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                          </div>
                          <span className={`text-xs ${step.status === "completed" ? "text-zinc-300" : "text-zinc-600"}`}>
                            {step.name}
                          </span>
                          {i < attempt.steps.length - 1 && (
                            <div className={`w-6 h-0.5 ${step.status === "completed" ? "bg-green-500/30" : "bg-zinc-800"}`} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Analysis */}
                    {attempt.analysis && (
                      <div className="space-y-3 bg-zinc-900/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">AI Analysis</span>
                          {attempt.analysis.confidence && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                              attempt.analysis.confidence === "high"
                                ? "bg-green-500/15 text-green-400"
                                : attempt.analysis.confidence === "medium"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-red-500/15 text-red-400"
                            }`}>{attempt.analysis.confidence}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500">Root Cause</span>
                          <p className="text-sm text-zinc-300 mt-0.5">{attempt.analysis.root_cause}</p>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500">Fix</span>
                          <p className="text-sm text-zinc-300 mt-0.5">{attempt.analysis.fix_description}</p>
                        </div>
                      </div>
                    )}

                    {attempt.error_message && (
                      <div className="mt-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-red-400 font-semibold">Error</span>
                        </div>
                        <p className="text-xs text-red-300/70 font-mono">{attempt.error_message}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
