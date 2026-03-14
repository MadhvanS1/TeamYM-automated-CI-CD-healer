import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Bug, Zap, GitPullRequest, FileCode, Terminal, ExternalLink,
  CheckCircle2, AlertTriangle, Loader2, TestTube2, Copy, Check
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fixLoading, setFixLoading] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchIssue = async () => {
    try {
      const res = await axios.get(`${API}/issues/${id}`);
      setIssue(res.data);
      if (["fixing", "creating_pr"].includes(res.data.status)) {
        setTimeout(fetchIssue, 3000);
      }
    } catch { toast.error("Failed to load issue"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchIssue(); }, [id]);

  const generateFix = async () => {
    setFixLoading(true);
    try {
      await axios.post(`${API}/issues/${id}/fix`);
      toast.success("Fix generation started");
      setTimeout(fetchIssue, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate fix");
    } finally { setFixLoading(false); }
  };

  const createPR = async () => {
    setPrLoading(true);
    try {
      await axios.post(`${API}/issues/${id}/create-pr`);
      toast.success("PR creation started");
      setTimeout(fetchIssue, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create PR");
    } finally { setPrLoading(false); }
  };

  const copyCode = (code, key) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!issue) return <div className="p-8 text-center text-zinc-500">Issue not found</div>;

  const fix = issue.fix && !issue.fix.error ? issue.fix : null;
  const tests = issue.tests;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button data-testid="back-button" onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700/50 hover:bg-zinc-750 transition-all">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 data-testid="issue-title" className="text-xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
              {issue.title}
            </h1>
            <StatusBadge status={issue.severity} />
            <StatusBadge status={issue.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
            <span>{issue.type}</span>
            <span>{issue.file_path}</span>
            {issue.line_start && <span>L{issue.line_start}{issue.line_end && issue.line_end !== issue.line_start ? `-${issue.line_end}` : ""}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {issue.status === "open" && (
            <button data-testid="generate-fix-button" onClick={generateFix} disabled={fixLoading}
              className="h-9 px-4 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium border border-purple-500/20 hover:bg-purple-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {fixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Generate Fix
            </button>
          )}
          {issue.status === "fixed" && (
            <button data-testid="create-pr-button" onClick={createPR} disabled={prLoading}
              className="h-9 px-4 bg-green-500/15 text-green-400 rounded-lg text-sm font-medium border border-green-500/20 hover:bg-green-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {prLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
              Create PR
            </button>
          )}
          {issue.pr_url && (
            <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" data-testid="view-pr-link"
              className="h-9 px-4 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium border border-green-500/20 hover:bg-green-500/15 transition-all flex items-center gap-2">
              <ExternalLink className="w-4 h-4" /> View PR
            </a>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {issue.status === "fixing" && (
        <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <div>
            <p className="text-sm text-purple-300 font-medium">Generating fix...</p>
            <p className="text-xs text-purple-400/70">AI is analyzing the code and creating a fix with tests</p>
          </div>
        </div>
      )}
      {issue.status === "creating_pr" && (
        <div className="mb-6 bg-green-500/5 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
          <div>
            <p className="text-sm text-green-300 font-medium">Creating Pull Request...</p>
            <p className="text-xs text-green-400/70">Forking repo, creating branch, committing fix and tests</p>
          </div>
        </div>
      )}
      {issue.fix?.error && (
        <div className="mb-6 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Fix generation failed</span>
          </div>
          <p className="text-xs text-red-300/70 font-mono">{issue.fix.error}</p>
          <button onClick={generateFix} className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline">
            Try again
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Issue Details */}
        <div className="space-y-6">
          {/* Description */}
          <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Issue Details</h3>
            </div>
            <div className="p-5">
              <p data-testid="issue-description" className="text-sm text-zinc-300 leading-relaxed">{issue.description}</p>
              {issue.suggested_fix && (
                <div className="mt-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/40">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Suggested Fix</span>
                  <p className="text-sm text-zinc-300 mt-1">{issue.suggested_fix}</p>
                </div>
              )}
            </div>
          </div>

          {/* Code Snippet */}
          {issue.code_snippet && (
            <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-sm font-semibold text-zinc-200">Code Snippet</h3>
                  <code className="text-xs text-zinc-500 font-mono">{issue.file_path}{issue.line_start ? `:${issue.line_start}` : ""}</code>
                </div>
                <button onClick={() => copyCode(issue.code_snippet, "snippet")}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {copied === "snippet" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="p-4 overflow-auto max-h-[400px] text-xs text-zinc-400 font-mono leading-relaxed"
                style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {issue.code_snippet}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Fix & Tests */}
        <div className="space-y-6">
          {/* Generated Fix */}
          {fix && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">AI Generated Fix</h3>
                </div>
                <button onClick={() => copyCode(fix.fixed_content || "", "fix")}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {copied === "fix" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-5 space-y-4">
                {fix.commit_message && (
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Commit Message</span>
                    <p className="text-sm text-zinc-200 font-mono mt-1 bg-zinc-900/50 px-3 py-2 rounded">{fix.commit_message}</p>
                  </div>
                )}
                {fix.explanation && (
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Explanation</span>
                    <p data-testid="fix-explanation" className="text-sm text-zinc-300 mt-1 leading-relaxed">{fix.explanation}</p>
                  </div>
                )}
                {fix.diff_summary && (
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Changes</span>
                    <p className="text-sm text-zinc-300 mt-1">{fix.diff_summary}</p>
                  </div>
                )}
                {fix.fixed_content && (
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Fixed Code</span>
                    <pre className="mt-1 p-3 bg-zinc-900/50 rounded-lg overflow-auto max-h-[300px] text-xs text-green-300/80 font-mono"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      {fix.fixed_content}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Generated Tests */}
          {tests && tests.test_content && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TestTube2 className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Generated Tests</h3>
                  <span className="text-xs text-zinc-500 font-mono">{tests.test_count || 0} tests</span>
                </div>
                <button onClick={() => copyCode(tests.test_content, "test")}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {copied === "test" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="font-mono">{tests.test_file_path}</span>
                  <span>{tests.test_framework}</span>
                </div>
                {tests.test_descriptions?.length > 0 && (
                  <ul className="space-y-1">
                    {tests.test_descriptions.map((desc, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500/50 shrink-0" />
                        {desc}
                      </li>
                    ))}
                  </ul>
                )}
                <pre className="p-3 bg-zinc-900/50 rounded-lg overflow-auto max-h-[300px] text-xs text-amber-300/70 font-mono"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {tests.test_content}
                </pre>
              </div>
            </motion.div>
          )}

          {/* No fix yet */}
          {!fix && issue.status === "open" && (
            <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-12 text-center">
              <Zap className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No fix generated yet</p>
              <p className="text-xs text-zinc-600 mt-1">Click "Generate Fix" to let AI create a fix with tests</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
