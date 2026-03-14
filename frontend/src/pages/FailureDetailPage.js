import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, GitBranch, Zap, FileCode, AlertTriangle, Terminal,
  CheckCircle2, Clock, ExternalLink
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function FailureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [healing, setHealing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healingLoading, setHealingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/pipeline-runs/${id}`);
        setRun(res.data);
        if (res.data.healing_attempt_id) {
          const healRes = await axios.get(`${API}/healing-attempts/${res.data.healing_attempt_id}`);
          setHealing(healRes.data);
        }
      } catch {
        toast.error("Failed to load pipeline run");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const triggerHealing = async () => {
    setHealingLoading(true);
    try {
      const res = await axios.post(`${API}/healing-attempts/trigger`, { pipeline_run_id: id });
      setHealing(res.data);
      toast.success("Healing agent triggered");
      // Poll for updates
      const poll = setInterval(async () => {
        try {
          const updated = await axios.get(`${API}/healing-attempts/${res.data.id}`);
          setHealing(updated.data);
          if (["completed", "failed"].includes(updated.data.status)) {
            clearInterval(poll);
            if (updated.data.status === "completed") {
              toast.success("Healing completed successfully");
              // Refresh run data
              const runRes = await axios.get(`${API}/pipeline-runs/${id}`);
              setRun(runRes.data);
            }
          }
        } catch {
          clearInterval(poll);
        }
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to trigger healing");
    } finally {
      setHealingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500">Pipeline run not found</p>
      </div>
    );
  }

  const logs = run.logs?.["build-and-test"]?.log || "No logs available";
  const steps = run.logs?.["build-and-test"]?.steps || [];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          data-testid="back-button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700/50 hover:bg-zinc-750 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 data-testid="failure-detail-title" className="text-xl font-bold text-zinc-100 tracking-tight truncate" style={{ fontFamily: "Chivo, sans-serif" }}>
              {run.repo}
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {run.branch}</span>
            <span>SHA: {run.commit_sha?.slice(0, 7)}</span>
            <span>{run.workflow_name}</span>
            <span>{run.trigger}</span>
          </div>
        </div>
        {run.status === "failure" && !healing && (
          <button
            data-testid="trigger-healing-button"
            onClick={triggerHealing}
            disabled={healingLoading}
            className="h-9 px-5 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium border border-purple-500/20 hover:bg-purple-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {healingLoading ? (
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Trigger Healing
          </button>
        )}
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mb-6 bg-[#121214] border border-zinc-800/60 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" /> Pipeline Steps
          </h3>
          <div className="flex flex-wrap gap-2">
            {steps.map((step, i) => (
              <div
                key={i}
                data-testid={`pipeline-step-${i}`}
                className={`px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border ${
                  step.conclusion === "success"
                    ? "bg-green-500/5 border-green-500/20 text-green-400"
                    : step.conclusion === "failure"
                    ? "bg-red-500/5 border-red-500/20 text-red-400"
                    : "bg-zinc-800/50 border-zinc-700/30 text-zinc-500"
                }`}
              >
                {step.conclusion === "success" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : step.conclusion === "failure" ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                {step.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Logs */}
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-200">Error Logs</h3>
          </div>
          <div className="p-4 overflow-auto max-h-[600px]">
            <pre
              data-testid="error-logs"
              className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap break-all"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {logs}
            </pre>
          </div>
          {run.error_type && (
            <div className="px-5 py-3 border-t border-zinc-800/60 bg-red-500/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-mono font-semibold">{run.error_type}</span>
              </div>
              <p className="text-xs text-red-300/70 mt-1 font-mono">{run.error_message}</p>
              {run.category && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-mono">
                  {run.category}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: AI Analysis */}
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-zinc-200">AI Analysis</h3>
          </div>
          <div className="p-5 overflow-auto max-h-[600px]">
            {healing?.analysis ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Confidence</span>
                  <span
                    data-testid="analysis-confidence"
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      healing.analysis.confidence === "high"
                        ? "bg-green-500/15 text-green-400"
                        : healing.analysis.confidence === "medium"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {healing.analysis.confidence}
                  </span>
                </div>

                {/* Root Cause */}
                <div>
                  <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Root Cause</h4>
                  <p data-testid="analysis-root-cause" className="text-sm text-zinc-300 leading-relaxed">
                    {healing.analysis.root_cause}
                  </p>
                </div>

                {/* Fix Description */}
                <div>
                  <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Fix Applied</h4>
                  <p data-testid="analysis-fix-description" className="text-sm text-zinc-300 leading-relaxed">
                    {healing.analysis.fix_description}
                  </p>
                </div>

                {/* Files Modified */}
                {healing.analysis.fixes?.length > 0 && (
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Files Modified</h4>
                    <div className="space-y-2">
                      {healing.analysis.fixes.map((fix, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <FileCode className="w-3.5 h-3.5 text-purple-400" />
                          <code className="text-zinc-300 font-mono text-xs">{fix.file}</code>
                          <span className="text-xs px-1.5 py-0.5 bg-zinc-800/50 rounded text-zinc-500">{fix.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Assessment */}
                {healing.analysis.risk_assessment && (
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Risk Assessment</h4>
                    <p className="text-sm text-zinc-400 leading-relaxed">{healing.analysis.risk_assessment}</p>
                  </div>
                )}

                {/* PR Link */}
                {healing.pr_url && (
                  <a
                    href={healing.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="pr-link"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-400 hover:bg-purple-500/15 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Pull Request
                  </a>
                )}
              </motion.div>
            ) : healing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-zinc-400">Analyzing failure...</p>
                <p className="text-xs text-zinc-600 mt-1 font-mono">Status: {healing.status}</p>
              </div>
            ) : run.status === "failure" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-400">No analysis yet</p>
                <p className="text-xs text-zinc-600 mt-1">Trigger the healing agent to analyze this failure</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500/30 mb-3" />
                <p className="text-sm text-zinc-400">This run completed successfully</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Healing Timeline */}
      {healing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-[#121214] border border-zinc-800/60 rounded-lg p-5"
        >
          <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" /> Healing Timeline
          </h3>
          <div className="flex items-center gap-2">
            {healing.steps?.map((step, i) => (
              <div key={i} className="flex items-center gap-2 flex-1" data-testid={`healing-step-${i}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  step.status === "completed"
                    ? "bg-green-500/15 text-green-400"
                    : step.status === "in_progress"
                    ? "bg-purple-500/15 text-purple-400 animate-pulse"
                    : "bg-zinc-800/50 text-zinc-600"
                }`}>
                  {step.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : step.status === "in_progress" ? (
                    <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${
                    step.status === "completed" ? "text-zinc-300" : step.status === "in_progress" ? "text-purple-300" : "text-zinc-600"
                  }`}>{step.name}</p>
                </div>
                {i < healing.steps.length - 1 && (
                  <div className={`h-0.5 w-8 shrink-0 ${
                    step.status === "completed" ? "bg-green-500/30" : "bg-zinc-800"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
