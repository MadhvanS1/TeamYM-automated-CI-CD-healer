import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GitBranch, Search, Filter, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function PipelineRunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchRuns = async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      const res = await axios.get(`${API}/pipeline-runs`, { params });
      setRuns(res.data);
    } catch {
      toast.error("Failed to load pipeline runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [filter]);

  const filtered = runs.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.repo?.toLowerCase().includes(q) ||
      r.branch?.toLowerCase().includes(q) ||
      r.commit_sha?.toLowerCase().includes(q) ||
      r.error_type?.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 data-testid="pipeline-runs-title" className="text-2xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
            Pipeline Runs
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{runs.length} total runs</p>
        </div>
        <button
          data-testid="refresh-runs-button"
          onClick={() => { setLoading(true); fetchRuns(); }}
          className="h-9 px-3 bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-700/50 hover:bg-zinc-750 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            data-testid="search-runs-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by repo, branch, SHA..."
            className="w-full h-9 pl-9 pr-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-lg p-0.5">
          {["", "success", "failure", "healed"].map((f) => (
            <button
              key={f}
              data-testid={`filter-${f || "all"}`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filter === f ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="pipeline-runs-table">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Status</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Repository</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Branch</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Commit</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Error</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Duration</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-zinc-500 text-sm">
                    No pipeline runs found
                  </td>
                </tr>
              ) : (
                filtered.map((run) => (
                  <tr
                    key={run.id}
                    data-testid={`run-row-${run.id}`}
                    onClick={() => navigate(`/pipelines/${run.id}`)}
                    className="hover:bg-zinc-800/20 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-zinc-200 font-medium">{run.repo}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-zinc-400 font-mono flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> {run.branch}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
                        {run.commit_sha?.slice(0, 7)}
                      </code>
                    </td>
                    <td className="px-5 py-3">
                      {run.error_type ? (
                        <span className="text-xs text-red-400 font-mono truncate max-w-[200px] block">
                          {run.error_type}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-zinc-500 font-mono">
                        {run.duration_seconds ? `${run.duration_seconds}s` : "--"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-zinc-600 font-mono">{formatDate(run.created_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
