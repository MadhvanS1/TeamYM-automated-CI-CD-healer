import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/App";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, GitBranch, CheckCircle2, XCircle, Zap, Clock, TrendingUp,
  AlertTriangle, Sparkles, ArrowUpRight, Play
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const statCard = (icon, label, value, sub, color) => (
  <div className="bg-[#121214] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700/60 transition-colors">
    <div className="flex items-center justify-between mb-3">
      <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">{label}</span>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color}`}>
        {icon}
      </div>
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
    } catch {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const seedData = async () => {
    try {
      await axios.post(`${API}/simulate/seed`);
      toast.success("Simulation data seeded");
      fetchStats();
    } catch {
      toast.error("Failed to seed data");
    }
  };

  const simulateFailure = async () => {
    try {
      const res = await axios.post(`${API}/simulate/failure`);
      toast.success(`Simulated failure: ${res.data.error_type}`);
      fetchStats();
    } catch {
      toast.error("Failed to simulate");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const p = stats?.pipeline || {};
  const h = stats?.healing || {};

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 data-testid="dashboard-title" className="text-3xl font-black text-zinc-100 tracking-tighter" style={{ fontFamily: "Chivo, sans-serif" }}>
            Command Center
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time CI/CD pipeline monitoring & autonomous healing</p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="seed-data-button"
            onClick={seedData}
            className="h-9 px-4 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium border border-zinc-700/50 hover:bg-zinc-750 hover:border-zinc-600 transition-all active:scale-95 flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            Seed Demo
          </button>
          <button
            data-testid="simulate-failure-button"
            onClick={simulateFailure}
            className="h-9 px-4 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium border border-red-500/20 hover:bg-red-500/15 transition-all active:scale-95 flex items-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Simulate Failure
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {statCard(
          <Activity className="w-4 h-4 text-blue-400" />,
          "Total Runs", p.total || 0,
          `${p.success_rate || 0}% success rate`,
          "bg-blue-500/10"
        )}
        {statCard(
          <XCircle className="w-4 h-4 text-red-400" />,
          "Failed", p.failed || 0,
          `${p.total ? ((p.failed / p.total) * 100).toFixed(1) : 0}% failure rate`,
          "bg-red-500/10"
        )}
        {statCard(
          <Sparkles className="w-4 h-4 text-purple-400" />,
          "Healed", p.healed || 0,
          `${h.heal_rate || 0}% heal success`,
          "bg-purple-500/10"
        )}
        {statCard(
          <CheckCircle2 className="w-4 h-4 text-green-400" />,
          "Successful", p.successful || 0,
          `${p.total ? ((p.successful / p.total) * 100).toFixed(1) : 0}% pass rate`,
          "bg-green-500/10"
        )}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Runs */}
        <div className="lg:col-span-2 bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-200">Recent Pipeline Runs</h2>
            </div>
            <button
              data-testid="view-all-pipelines-button"
              onClick={() => navigate("/pipelines")}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {stats?.recent_runs?.length > 0 ? stats.recent_runs.map((run) => (
              <div
                key={run.id}
                data-testid={`pipeline-run-${run.id}`}
                onClick={() => navigate(`/pipelines/${run.id}`)}
                className="px-5 py-3 hover:bg-zinc-800/20 cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={run.status} />
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 font-medium truncate">{run.repo}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate">
                      {run.branch} &middot; {run.commit_sha?.slice(0, 7)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 font-mono shrink-0 ml-4">
                  {run.duration_seconds ? `${run.duration_seconds}s` : "--"}
                </div>
              </div>
            )) : (
              <div className="px-5 py-12 text-center">
                <p className="text-zinc-500 text-sm">No pipeline runs yet</p>
                <p className="text-zinc-600 text-xs mt-1">Click "Seed Demo" to populate sample data</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#121214] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Healing Activity</h2>
            </div>
            <button
              data-testid="view-all-healing-button"
              onClick={() => navigate("/healing")}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {stats?.recent_heals?.length > 0 ? stats.recent_heals.map((heal) => (
              <div key={heal.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={heal.status} size="sm" />
                  <span className="text-xs text-zinc-400 font-mono truncate">{heal.repo}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {heal.analysis?.summary || "Healing in progress..."}
                </p>
                {heal.pr_url && (
                  <a
                    href={heal.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-flex items-center gap-1"
                    data-testid={`heal-pr-link-${heal.id}`}
                  >
                    View PR <ArrowUpRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            )) : (
              <div className="px-5 py-12 text-center">
                <p className="text-zinc-500 text-sm">No healing activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Healing Stats Bar */}
      {h.total > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-[#121214] border border-zinc-800/60 rounded-lg p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-200">Healing Performance</h3>
          </div>
          <div className="w-full bg-zinc-800/50 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-700"
              style={{ width: `${h.heal_rate || 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-zinc-500 font-mono">{h.successful} successful / {h.total} total</span>
            <span className="text-xs text-zinc-400 font-mono font-semibold">{h.heal_rate}% success</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
