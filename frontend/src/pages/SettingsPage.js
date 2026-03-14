import { useState, useEffect } from "react";
import { API, useAuth } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Settings, Shield, Cpu, FileCode, Bell, Save, Eye, EyeOff, Github
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    ai_model: "gpt-4o",
    max_heal_attempts: 3,
    auto_merge: false,
    max_files_per_fix: 5,
    protected_paths: [".github/workflows/healing-agent.yml", ".env"],
    notifications_enabled: true,
    github_connected: false,
  });
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${API}/config`);
        setConfig(res.data);
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const data = { ...config };
      if (githubToken) data.github_token = githubToken;
      const res = await axios.put(`${API}/config`, data);
      setConfig(res.data);
      setGithubToken("");
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const addProtectedPath = () => {
    if (newPath && !config.protected_paths?.includes(newPath)) {
      setConfig({ ...config, protected_paths: [...(config.protected_paths || []), newPath] });
      setNewPath("");
    }
  };

  const removeProtectedPath = (path) => {
    setConfig({ ...config, protected_paths: (config.protected_paths || []).filter((p) => p !== path) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 data-testid="settings-title" className="text-2xl font-bold text-zinc-100 tracking-tight" style={{ fontFamily: "Chivo, sans-serif" }}>
          Agent Configuration
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Configure the healing agent behavior</p>
      </div>

      <div className="space-y-6">
        {/* GitHub Connection */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-[#121214] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Github className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">GitHub Connection</h2>
            {config.github_connected && (
              <span className="px-2 py-0.5 bg-green-500/15 text-green-400 rounded text-xs font-semibold">Connected</span>
            )}
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Personal Access Token (PAT)</label>
            <div className="relative">
              <input
                data-testid="github-token-input"
                type={showToken ? "text" : "password"}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={config.github_connected ? "Token configured (enter new to update)" : "ghp_xxxx..."}
                className="w-full h-10 px-3 pr-10 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">Requires repo + workflow scopes. <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Generate token</a></p>
          </div>
        </motion.div>

        {/* AI Configuration */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#121214] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-semibold text-zinc-200">AI Configuration</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Model</label>
              <select
                data-testid="ai-model-select"
                value={config.ai_model}
                onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                className="w-full h-10 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-5.2">GPT-5.2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Max Heal Attempts</label>
              <input
                data-testid="max-heal-attempts-input"
                type="number"
                min={1}
                max={10}
                value={config.max_heal_attempts}
                onChange={(e) => setConfig({ ...config, max_heal_attempts: parseInt(e.target.value) || 3 })}
                className="w-full h-10 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Safety Configuration */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#121214] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Safety Guards</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Max Files Per Fix</label>
                <input
                  data-testid="max-files-input"
                  type="number"
                  min={1}
                  max={20}
                  value={config.max_files_per_fix}
                  onChange={(e) => setConfig({ ...config, max_files_per_fix: parseInt(e.target.value) || 5 })}
                  className="w-full h-10 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    data-testid="auto-merge-toggle"
                    onClick={() => setConfig({ ...config, auto_merge: !config.auto_merge })}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
                      config.auto_merge ? "bg-purple-500" : "bg-zinc-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      config.auto_merge ? "translate-x-[18px]" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-zinc-300">Auto-merge PRs</span>
                </label>
              </div>
            </div>

            {/* Protected Paths */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Protected Paths</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {config.protected_paths?.map((path) => (
                  <span
                    key={path}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded text-xs text-zinc-400 font-mono"
                  >
                    <FileCode className="w-3 h-3" />
                    {path}
                    <button
                      onClick={() => removeProtectedPath(path)}
                      className="ml-1 text-zinc-600 hover:text-red-400 transition-colors"
                      data-testid={`remove-path-${path.replace(/[^a-z0-9]/gi, '-')}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  data-testid="new-protected-path-input"
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="Add protected path..."
                  onKeyDown={(e) => e.key === "Enter" && addProtectedPath()}
                  className="flex-1 h-9 px-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono transition-all"
                />
                <button
                  data-testid="add-path-button"
                  onClick={addProtectedPath}
                  className="h-9 px-3 bg-zinc-800 text-zinc-300 rounded-lg text-sm border border-zinc-700/50 hover:bg-zinc-750 transition-all"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#121214] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Notifications</h2>
            </div>
            <div
              data-testid="notifications-toggle"
              onClick={() => setConfig({ ...config, notifications_enabled: !config.notifications_enabled })}
              className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
                config.notifications_enabled ? "bg-purple-500" : "bg-zinc-700"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                config.notifications_enabled ? "translate-x-[18px]" : "translate-x-0.5"
              }`} />
            </div>
          </div>
        </motion.div>

        {/* Save Button */}
        <button
          data-testid="save-config-button"
          onClick={saveConfig}
          disabled={saving}
          className="w-full h-11 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Configuration
        </button>
      </div>
    </div>
  );
}
