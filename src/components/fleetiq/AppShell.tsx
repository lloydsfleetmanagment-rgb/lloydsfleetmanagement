import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  Factory,
  Mountain,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { LloydsMark, ThriveniMark, WordMark } from "./Brand";
import { Particles } from "./Particles";
import { EmergencyWatcher } from "./EmergencyWatcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", key: "nav.dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "operator"] },
  { to: "/operator", key: "nav.operator", label: "Operator Console", icon: ClipboardList, roles: ["admin", "supervisor", "operator"] },
  { to: "/fleet", key: "nav.fleet", label: "Fleet", icon: Truck, roles: ["admin", "supervisor", "operator"] },
  { to: "/production", key: "nav.production", label: "Production", icon: BarChart3, roles: ["admin", "supervisor", "operator"] },
  { to: "/dig-faces", key: "nav.digfaces", label: "Dig Faces", icon: Mountain, roles: ["admin", "supervisor", "operator"] },
  { to: "/crushers", key: "nav.crushers", label: "Crushers & Pipeline", icon: Factory, roles: ["admin", "supervisor", "operator"] },
  { to: "/reports", key: "nav.reports", label: "Reports", icon: BarChart3, roles: ["admin", "supervisor", "operator"] },
  { to: "/settings", key: "nav.settings", label: "Settings", icon: Settings, roles: ["admin", "supervisor", "operator"] },
] as const;

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden text-right md:block">
      <p className="font-mono text-sm tabular-nums">
        {now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" })}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { role, profile, signOut, isAdmin, isOperator } = useAuth();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => (role ? (n.roles as readonly string[]).includes(role) : false));
  // Only operators see the console in their chosen language.
  const label = (item: (typeof NAV)[number]) => (isOperator ? t(item.key) : item.label);

  return (
    <div className="relative min-h-screen">
      <Particles />
      <EmergencyWatcher />
      <div className="relative z-10 flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 md:flex",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <div className="flex h-16 items-center gap-2 px-4">
            <LloydsMark className="h-8" />
            {!collapsed && <WordMark className="text-sm" />}
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {items.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300",
                    active
                      ? "bg-secondary text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
                      : "text-muted-foreground hover:translate-x-0.5 hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                  {!collapsed && <span className="truncate">{label(item)}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-3 border-t border-border p-3">
            {!collapsed && (
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Mine partner</p>
                <ThriveniMark className="mt-2 h-7" />
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && <span className="ml-2">Collapse</span>}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
            <LloydsMark className="h-8 md:hidden" />
            <WordMark className="hidden text-base md:inline" />
            <span className="hidden text-xs text-muted-foreground lg:inline">Surjagarh Iron Ore Mine · 348 Ha</span>
            <div className="ml-auto flex items-center gap-4">
              <LiveClock />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {role ? role.toUpperCase() : "—"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="rounded-full">
                    {(profile?.employee_name || "U").slice(0, 18)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <p className="text-sm">{profile?.employee_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">Emp ID: {profile?.employee_id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Settings</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/settings">Manage users</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void signOut()}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar/60 px-3 py-2 md:hidden">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs",
                  pathname.startsWith(item.to) ? "bg-secondary text-foreground" : "text-muted-foreground",
                )}
              >
                {label(item)}
              </Link>
            ))}
          </nav>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
