import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Bug, Scan, ExternalLink, Filter, Search,
  AlertTriangle, ShieldAlert, Gauge, Code, Package, Loader2
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const typeIcons = {
  bug: <Bug className="w-3.5 h-3.5 text-red-400" />,
  security: <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />,
  performance: <Gauge className="w-3.5 h-3.5 text-amber-400" />,
  quality: <Code className="w-3.5 h-3.5 text-blue-400" />,
  lint: <Code className="w-3.5 h-3.5 text-zinc-400" />,
  dependency: <Package className="w-3.5 h-3.5 text-purple-400" />,
};

export default function RepoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repo, setRepo] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState({ severity: "", type: "", status: "" });
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const [repoRes, issuesRes] = await Promise.all([
        axios.get(`${API}/repos/${id}`),
        axios.get(`${API}/repos/${id}/issues`, { params: { ...filter } })
      ]);
      setRepo(repoRes.data);
      setIssues(issuesRes.data);
      if (repoRes.data.scan_status === "scanning") {
        setTimeout(fetchData, 3000);
      }
    } catch {
      toast.error("Failed to load repo data");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id, filter]);

  const startScan = async () => {
    setScanning(true);
    try {
      await axios.post(`${API}/repos/${id}/scan`);
      toast.success("Scan started");
      setTimeout(fetchData, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start scan");
    } finally { setScanning(false); }
  };

  const filtered = issues.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.title?.toLowerCase().includes(q) || i.file_path?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!repo) return <div className="p-8 text-center text-zinc-500">Repository not found</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button data-testid="back-button" onClick={() => navigate("/repos")}
          className="w-9 h-9 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700/50 hover:bg-zinc-750 transition-all">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 data-testid="repo-detail-title" className="text-xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
              {repo.full_name}
            </h1>
            <StatusBadge status={repo.scan_status} />
            <a href={repo.url} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
            {repo.language && <span>{repo.language}</span>}
            <span>{repo.issues_found} issues found</span>
            <span>{repo.prs_created} PRs created</span>
            {repo.scan_status === "scanning" && repo.scan_progress && (
              <span className="text-purple-400 animate-pulse">{repo.scan_progress}</span>
            )}
          </div>
        </div>
        <button data-testid="rescan-button" onClick={startScan} disabled={scanning || repo.scan_status === "scanning"}
          className="h-9 px-4 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium border border-purple-500/20 hover:bg-purple-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
          {scanning || repo.scan_status === "scanning" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
          {repo.scan_status === "scanning" ? "Scanning..." : "Re-scan"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input data-testid="search-issues" type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full h-9 pl-9 pr-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all" />
        </div>
        <select data-testid="filter-severity" value={filter.severity} onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="h-9 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select data-testid="filter-type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="h-9 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50">
          <option value="">All Types</option>
          <option value="bug">Bug</option>
          <option value="security">Security</option>
          <option value="performance">Performance</option>
          <option value="quality">Quality</option>
          <option value="lint">Lint</option>
          <option value="dependency">Dependency</option>
        </select>
        <select data-testid="filter-status" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="h-9 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="fixing">Fixing</option>
          <option value="fixed">Fixed</option>
          <option value="pr_created">PR Created</option>
        </select>
      </div>

      {/* Issues Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="issues-table">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Severity</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Type</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Issue</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">File</th>
                <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-500 text-sm">
                  {repo.scan_status === "scanning" ? "Scanning in progress..." : "No issues found"}
                </td></tr>
              ) : filtered.map((issue) => (
                <tr key={issue.id} data-testid={`issue-row-${issue.id}`}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  className="hover:bg-zinc-800/20 cursor-pointer transition-colors">
                  <td className="px-5 py-3"><StatusBadge status={issue.severity} size="sm" /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {typeIcons[issue.type] || typeIcons.bug}
                      <span className="text-xs text-zinc-400 capitalize">{issue.type}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-zinc-200 block truncate max-w-[400px]">{issue.title}</span>
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs text-zinc-500 font-mono truncate max-w-[200px] block">{issue.file_path}</code>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={issue.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
