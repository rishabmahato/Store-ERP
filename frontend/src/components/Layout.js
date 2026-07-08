import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  Receipt, FileBarChart2, Sparkles, LogOut, Moon, Sun, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/pos", label: "POS Billing", icon: ShoppingCart, tid: "nav-pos" },
  { to: "/inventory", label: "Inventory", icon: Package, tid: "nav-inventory" },
  { to: "/customers", label: "Customers", icon: Users, tid: "nav-customers" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, tid: "nav-suppliers" },
  { to: "/sales", label: "Sales", icon: Receipt, tid: "nav-sales" },
  { to: "/reports", label: "Reports", icon: FileBarChart2, tid: "nav-reports" },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles, tid: "nav-ai" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-64 flex-col border-r border-border bg-card/40">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-base tracking-tight" style={{ fontFamily: "Outfit" }}>
              Laxmi Electronics
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.2em]">ERP</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, tid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={tid}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-semibold text-sm">
              {user?.name?.[0] ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.role?.replace("_", " ")}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm" className="flex-1"
              onClick={toggle} data-testid="theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline" size="sm" className="flex-1"
              onClick={doLogout} data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-semibold" style={{ fontFamily: "Outfit" }}>Laxmi ERP</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={doLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex overflow-x-auto gap-1 px-3 pb-2">
          {nav.map(({ to, label, icon: Icon, tid }) => (
            <NavLink key={to} to={to} end={to === "/"}
              data-testid={`${tid}-mobile`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground bg-secondary/50"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
