import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import {
  LayoutDashboard, GitBranch, Zap, Settings, LogOut, ChevronLeft,
  ChevronRight, Shield
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/pipelines", icon: GitBranch, label: "Pipeline Runs" },
  { path: "/healing", icon: Zap, label: "Healing History" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div
      data-testid="sidebar"
      className={`h-full bg-[#050505] border-r border-zinc-800/60 flex flex-col transition-all duration-300 shrink-0 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-sm font-bold text-zinc-100 tracking-tight block" style={{ fontFamily: "Chivo, sans-serif" }}>
                HealAgent
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">v1.0.0</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-zinc-800/60 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-400" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-zinc-800/60 p-3">
        {!collapsed && user && (
          <div className="px-2 mb-3">
            <p className="text-xs text-zinc-300 font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-zinc-600 truncate font-mono">{user.email}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            data-testid="logout-button"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all flex-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            data-testid="toggle-sidebar"
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30 transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
