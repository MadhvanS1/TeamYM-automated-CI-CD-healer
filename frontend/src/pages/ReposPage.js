import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FolderGit2, Plus, Scan, Trash2, Bug, GitPullRequest, ExternalLink, Loader2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function ReposPage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanningId, setScanningId] = useState(null);

  const fetchRepos = async () => {
    try {
      const res = await axios.get(`${API}/repos`);
      setRepos(res.data);
    } catch { toast.error("Failed to load repos"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRepos();
    const interval = setInterval(fetchRepos, 5000);
    return () => clearInterval(interval);
  }, []);

  const addRepo = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setAdding(true);
    try {
      const res = await axios.post(`${API}/repos`, { url: repoUrl });
      toast.success(`Added ${res.data.full_name}`);
      setRepoUrl("");
      fetchRepos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add repo");
    } finally { setAdding(false); }
  };

  const startScan = async (repoId) => {
    setScanningId(repoId);
    try {
      await axios.post(`${API}/repos/${repoId}/scan`);
      toast.success("Scan started");
      fetchRepos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start scan");
    } finally { setScanningId(null); }
  };

  const deleteRepo = async (repoId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this repository and all its issues?")) return;
    try {
      await axios.delete(`${API}/repos/${repoId}`);
      toast.success("Repository deleted");
      fetchRepos();
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 data-testid="repos-title" className="text-2xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
          Repositories
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Add open-source repos to scan for bugs and generate fixes</p>
      </div>

      {/* Add Repo Form */}
      <form onSubmit={addRepo} className="mb-8 bg-[#121214] border border-zinc-800/60 rounded-lg p-5">
        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Add GitHub Repository
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input data-testid="repo-url-input" type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full h-10 pl-9 pr-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono transition-all" />
          </div>
          <button data-testid="add-repo-submit" type="submit" disabled={adding || !repoUrl.trim()}
            className="h-10 px-5 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Repo
          </button>
        </div>
      </form>

      {/* Repos List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : repos.length === 0 ? (
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-12 text-center">
          <FolderGit2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No repositories added yet</p>
          <p className="text-zinc-600 text-xs mt-1">Paste a GitHub URL above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((repo, idx) => (
            <motion.div key={repo.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              data-testid={`repo-item-${repo.id}`}
              onClick={() => navigate(`/repos/${repo.id}`)}
              className="bg-[#121214] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700/60 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800/50 flex items-center justify-center shrink-0">
                    <FolderGit2 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-200 truncate">{repo.full_name}</h3>
                      <StatusBadge status={repo.scan_status} size="sm" />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                      {repo.language && <span className="font-mono">{repo.language}</span>}
                      {repo.scan_status === "scanning" && repo.scan_progress && (
                        <span className="text-purple-400 animate-pulse truncate max-w-[300px]">{repo.scan_progress}</span>
                      )}
                      {repo.scan_status === "completed" && (
                        <>
                          <span className="flex items-center gap-1"><Bug className="w-3 h-3" /> {repo.issues_found} issues</span>
                          <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> {repo.prs_created} PRs</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <a href={repo.url} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                    data-testid={`repo-external-${repo.id}`}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {repo.scan_status !== "scanning" && (
                    <button data-testid={`scan-repo-${repo.id}`}
                      onClick={(e) => { e.stopPropagation(); startScan(repo.id); }}
                      disabled={scanningId === repo.id}
                      className="h-8 px-3 bg-purple-500/10 text-purple-400 rounded-md text-xs font-medium border border-purple-500/20 hover:bg-purple-500/15 transition-all flex items-center gap-1.5 disabled:opacity-50">
                      {scanningId === repo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
                      Scan
                    </button>
                  )}
                  <button data-testid={`delete-repo-${repo.id}`}
                    onClick={(e) => deleteRepo(repo.id, e)}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
