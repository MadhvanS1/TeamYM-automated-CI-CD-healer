import { useState, useEffect } from "react";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GitPullRequest, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function PullRequestsPage() {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPRs = async () => {
      try {
        const res = await axios.get(`${API}/prs`);
        setPrs(res.data);
      } catch { toast.error("Failed to load PRs"); }
      finally { setLoading(false); }
    };
    fetchPRs();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 data-testid="prs-title" className="text-2xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
          Pull Requests
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{prs.length} PRs created across all repositories</p>
      </div>

      {prs.length === 0 ? (
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-12 text-center">
          <GitPullRequest className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No pull requests created yet</p>
          <p className="text-zinc-600 text-xs mt-1">Fix an issue and create a PR from the issue detail page</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prs.map((pr, idx) => (
            <motion.div key={pr.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              data-testid={`pr-item-${pr.id}`}
              className="bg-[#121214] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700/60 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    pr.status === "open" ? "bg-green-500/10" : pr.status === "merged" ? "bg-purple-500/10" : "bg-zinc-800/50"
                  }`}>
                    {pr.status === "merged" ? <CheckCircle2 className="w-5 h-5 text-purple-400" /> :
                     pr.status === "open" ? <GitPullRequest className="w-5 h-5 text-green-400" /> :
                     <Clock className="w-5 h-5 text-zinc-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">{pr.title}</span>
                      <StatusBadge status={pr.status} size="sm" />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
                      <span>{pr.repo_full_name}</span>
                      <span>{pr.branch}</span>
                      {pr.number && <span>#{pr.number}</span>}
                      <span>{formatDate(pr.created_at)}</span>
                    </div>
                  </div>
                </div>
                {pr.url && (
                  <a href={pr.url} target="_blank" rel="noopener noreferrer"
                    data-testid={`pr-link-${pr.id}`}
                    className="shrink-0 ml-4 h-8 px-3 bg-green-500/10 text-green-400 rounded-md text-xs font-medium border border-green-500/20 hover:bg-green-500/15 transition-all flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" /> View on GitHub
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
