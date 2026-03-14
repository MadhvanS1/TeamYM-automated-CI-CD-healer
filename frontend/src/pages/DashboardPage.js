import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, Bug, GitPullRequest, FolderGit2, AlertTriangle, ShieldAlert,
  ArrowUpRight, Gauge, Zap, TrendingUp
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700/60 transition-colors">
    <div className="flex items-center justify-between mb-3">
      <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">{label}</span>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color}`}>{icon}</div>
    </div>
    <div className="text-3xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>{value}</div>
    {sub && <p className="text-xs text-zinc-500 mt-1 font-mono">{sub}</p>}
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/dashboard/stats`);
      setStats(res.data);
    } catch { toast.error("Failed to load stats"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); const i = setInterval(fetchStats, 15000); return () => clearInterval(i); }, [fetchStats]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const iss = stats?.issues || {};
  const pr = stats?.prs || {};

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 data-testid="dashboard-title" className="text-3xl font-black text-zinc-100 tracking-tighter" style={{ fontFamily: "Chivo, sans-serif" }}>
            Command Center
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Scan repos, find bugs, generate fixes, raise PRs</p>
        </div>
        <button data-testid="add-repo-button" onClick={() => navigate("/repos")}
          className="h-9 px-4 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium border border-purple-500/20 hover:bg-purple-500/20 transition-all active:scale-95 flex items-center gap-2">
          <FolderGit2 className="w-4 h-4" /> Add Repository
        </button>
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<FolderGit2 className="w-4 h-4 text-blue-400" />} label="Repositories"
          value={stats?.repos?.total || 0} sub="Scanned repos" color="bg-blue-500/10" />
        <StatCard icon={<Bug className="w-4 h-4 text-red-400" />} label="Issues Found"
          value={iss.total || 0} sub={`${iss.critical || 0} critical, ${iss.high || 0} high`} color="bg-red-500/10" />
        <StatCard icon={<Zap className="w-4 h-4 text-purple-400" />} label="Issues Fixed"
          value={iss.fixed || 0} sub={`${iss.total ? ((iss.fixed / iss.total) * 100).toFixed(0) : 0}% fix rate`} color="bg-purple-500/10" />
        <StatCard icon={<GitPullRequest className="w-4 h-4 text-green-400" />} label="PRs Created"
          value={pr.total || 0} sub={`${pr.open || 0} open`} color="bg-green-500/10" />
      </motion.div>

      {/* Severity Breakdown */}
      {iss.total > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="mb-8 bg-[#121214] border border-zinc-800/60 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-zinc-500" /> Issue Severity Breakdown
          </h3>
          <div className="flex gap-3 h-3 rounded-full overflow-hidden bg-zinc-800/50">
            {iss.critical > 0 && <div className="bg-red-500 rounded-full" style={{ flex: iss.critical }} title={`Critical: ${iss.critical}`} />}
            {iss.high > 0 && <div className="bg-orange-500 rounded-full" style={{ flex: iss.high }} title={`High: ${iss.high}`} />}
            {iss.medium > 0 && <div className="bg-amber-500 rounded-full" style={{ flex: iss.medium }} title={`Medium: ${iss.medium}`} />}
            {iss.low > 0 && <div className="bg-blue-500 rounded-full" style={{ flex: iss.low }} title={`Low: ${iss.low}`} />}
          </div>
          <div className="flex gap-4 mt-2">
            {[["Critical", iss.critical, "text-red-400"], ["High", iss.high, "text-orange-400"],
              ["Medium", iss.medium, "text-amber-400"], ["Low", iss.low, "text-blue-400"]]
              .filter(([, v]) => v > 0).map(([l, v, c]) => (
                <span key={l} className={`text-xs font-mono ${c}`}>{l}: {v}</span>
              ))}
          </div>
        </motion.div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Issues */}
        <div className="lg:col-span-2 bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Recent Issues</h2>
            </div>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {stats?.recent_issues?.length > 0 ? stats.recent_issues.map((issue) => (
              <div key={issue.id} data-testid={`issue-row-${issue.id}`}
                onClick={() => navigate(`/issues/${issue.id}`)}
                className="px-5 py-3 hover:bg-zinc-800/20 cursor-pointer transition-colors flex items-center gap-3">
                <StatusBadge status={issue.severity} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{issue.title}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{issue.file_path}</div>
                </div>
                <StatusBadge status={issue.status} size="sm" />
              </div>
            )) : (
              <div className="px-5 py-12 text-center">
                <Bug className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No issues found yet</p>
                <p className="text-zinc-600 text-xs mt-1">Add a repository and start scanning</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent PRs & Repos */}
        <div className="space-y-6">
          {/* Recent PRs */}
          <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-green-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Recent PRs</h2>
              </div>
              <button data-testid="view-all-prs" onClick={() => navigate("/prs")}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {stats?.recent_prs?.length > 0 ? stats.recent_prs.map((pr) => (
                <div key={pr.id} className="px-5 py-3">
                  <div className="text-sm text-zinc-300 truncate">{pr.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500 font-mono">{pr.repo_full_name}</span>
                    {pr.url && (
                      <a href={pr.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        View <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-zinc-600 text-xs">No PRs yet</div>
              )}
            </div>
          </div>

          {/* Recent Repos */}
          <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Repositories</h2>
              </div>
              <button data-testid="view-all-repos" onClick={() => navigate("/repos")}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {stats?.recent_repos?.length > 0 ? stats.recent_repos.map((repo) => (
                <div key={repo.id} data-testid={`repo-card-${repo.id}`}
                  onClick={() => navigate(`/repos/${repo.id}`)}
                  className="px-5 py-3 hover:bg-zinc-800/20 cursor-pointer transition-colors">
                  <div className="text-sm text-zinc-200 font-medium">{repo.full_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={repo.scan_status} size="sm" />
                    <span className="text-xs text-zinc-500 font-mono">{repo.issues_found} issues</span>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-zinc-600 text-xs">No repos added</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
