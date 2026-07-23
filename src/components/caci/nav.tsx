"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApp, type Screen } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Radio,
  BookOpen,
  Shield,
  Settings,
  ScrollText,
  Inbox,
  MessageSquare,
  User,
  Bell,
  MoreHorizontal,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { CaciLogo } from "./ui";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// ============================================================
// CACI Bottom Navigation (mobile) — 5 tabs floating pill style
// 4 main tabs + 5th "More" tab opening a side drawer from the right
// ============================================================

interface NavItem {
  screen: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const adminNav: NavItem[] = [
  { screen: "admin-dashboard", label: "Home", icon: LayoutDashboard },
  { screen: "admin-members", label: "Members", icon: Users },
  { screen: "admin-groups", label: "Groups", icon: UsersRound },
  { screen: "admin-broadcasts", label: "Broadcasts", icon: Radio },
];

const memberNav: NavItem[] = [
  { screen: "member-inbox", label: "Inbox", icon: Inbox },
  { screen: "member-groups", label: "Chats", icon: MessageSquare },
  { screen: "member-broadcasts", label: "Updates", icon: Radio },
  { screen: "member-sermons", label: "Sermons", icon: BookOpen },
];

export function BottomNav({ role }: { role: "admin" | "member" }) {
  const { screen, navigate, resetTo, user, setUser } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const primaryItems = role === "admin" ? adminNav : memberNav;
  const menuSections = role === "admin" ? adminSidebarItems : memberSidebarItems;

  const isPrimaryActive = (item: NavItem) => {
    if (screen === item.screen) return true;
    if (role === "admin") {
      if (item.screen === "admin-members" && screen.startsWith("admin-member")) return true;
      if (item.screen === "admin-groups" && screen.startsWith("admin-group")) return true;
      if (item.screen === "admin-broadcasts" && screen.startsWith("admin-broadcast")) return true;
    } else {
      if (item.screen === "member-groups" && (screen === "member-group-chat" || screen === "member-forum")) return true;
      if (item.screen === "member-broadcasts" && screen === "member-broadcast-detail") return true;
      if (item.screen === "member-sermons" && screen === "member-sermon-detail") return true;
    }
    return false;
  };

  // Check if any primary item is active
  const isAnyPrimaryActive = primaryItems.some((item) => isPrimaryActive(item));
  // More tab is active if side drawer is open OR active screen is outside primary 4 tabs
  const isMoreActive = drawerOpen || !isAnyPrimaryActive;

  const handlePrimaryClick = (item: NavItem) => {
    if (item.screen === "admin-dashboard" || item.screen === "member-inbox") {
      resetTo(item.screen);
    } else {
      navigate(item.screen);
    }
  };

  return (
    <>
      {/* Floating Bottom Nav Container */}
      <nav
        className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md rounded-3xl p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-n100/80 transition-all duration-200"
        style={{ marginBottom: "var(--safe-bottom)" }}
        aria-label="Primary navigation"
      >
        <ul className="grid grid-cols-5 items-center justify-between gap-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isPrimaryActive(item);
            return (
              <li key={item.screen} className="flex-1">
                <button
                  onClick={() => handlePrimaryClick(item)}
                  className={cn(
                    "w-full flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 ease-out select-none tap-squish",
                    active
                      ? "bg-caci-blue-bg text-caci-blue shadow-xs font-semibold"
                      : "text-n500 hover:text-n900 hover:bg-n50 active:bg-n100"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={20} className={cn("transition-transform duration-200", active && "scale-110")} />
                  <span className="text-[11px] leading-tight mt-1 truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}

          {/* 5th Tab: More Button */}
          <li className="flex-1">
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(
                "w-full flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 ease-out select-none tap-squish",
                isMoreActive
                  ? "bg-caci-blue-bg text-caci-blue shadow-xs font-semibold"
                  : "text-n500 hover:text-n900 hover:bg-n50 active:bg-n100"
              )}
              aria-expanded={drawerOpen}
              aria-label="Open more menu navigation"
            >
              <MoreHorizontal size={20} className={cn("transition-transform duration-200", isMoreActive && "scale-110")} />
              <span className="text-[11px] leading-tight mt-1 truncate">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Side Drawer from Right */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm bg-white p-0 border-l border-n100 shadow-2xl flex flex-col h-full z-50">
          {/* Drawer Header */}
          <div className="bg-caci-blue text-white px-5 py-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <CaciLogo size={34} />
              <div>
                <h2 className="font-bold text-[16px] leading-tight">CACI Hub</h2>
                <p className="text-[11px] text-white/70 capitalize leading-tight">
                  {role === "admin" ? "Admin Portal" : "Member Portal"}
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          {user && (
            <div className="mx-4 my-3 p-3 rounded-xl bg-caci-blue-bg/60 border border-caci-blue/15 flex items-center gap-3 shrink-0">
              <div className="size-10 rounded-full bg-caci-blue text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {user.fullName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-n900 truncate">{user.fullName}</p>
                <p className="text-[12px] text-n400 capitalize">{user.role}</p>
              </div>
            </div>
          )}

          {/* Navigation Menu List */}
          <div className="flex-1 overflow-y-auto scroll-caci px-3 py-2 space-y-4">
            {menuSections.map((sec) => (
              <div key={sec.section} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-n400">
                  {sec.section}
                </p>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = screen === item.screen;
                    return (
                      <button
                        key={item.screen}
                        onClick={() => {
                          setDrawerOpen(false);
                          if (item.screen === "admin-dashboard" || item.screen === "member-inbox") {
                            resetTo(item.screen);
                          } else {
                            navigate(item.screen);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all text-left group",
                          isSelected
                            ? "bg-caci-blue-bg text-caci-blue font-semibold shadow-xs"
                            : "text-n700 hover:bg-n50 hover:text-n900"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isSelected ? "bg-caci-blue text-white" : "bg-n100/70 text-n500 group-hover:bg-n100 group-hover:text-n900"
                            )}
                          >
                            <Icon size={18} />
                          </div>
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight
                          size={16}
                          className={cn(
                            "transition-transform group-hover:translate-x-0.5",
                            isSelected ? "text-caci-blue" : "text-n300"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-n100 bg-n50/50 flex flex-col gap-2 shrink-0">
            <button
              onClick={() => {
                setDrawerOpen(false);
                setUser(null);
                resetTo("login");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-caci-red hover:bg-caci-red-bg transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ============================================================
// CACI Sidebar (desktop) — 240px, CACI Blue bg, white text
// ============================================================

const adminSidebarItems: { section: string; items: NavItem[] }[] = [
  {
    section: "Main",
    items: [
      { screen: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
      { screen: "admin-members", label: "Members", icon: Users },
      { screen: "admin-groups", label: "Groups", icon: UsersRound },
    ],
  },
  {
    section: "Communication",
    items: [
      { screen: "admin-broadcasts", label: "Broadcasts", icon: Radio },
      { screen: "admin-sermons", label: "Sermons", icon: BookOpen },
      { screen: "admin-forum", label: "Assembly Forum", icon: MessageSquare },
    ],
  },
  {
    section: "Administration",
    items: [
      { screen: "admin-accounts", label: "User Accounts", icon: Shield },
      { screen: "admin-audit", label: "Audit Log", icon: ScrollText },
      { screen: "admin-settings", label: "Settings", icon: Settings },
    ],
  },
];

const memberSidebarItems: { section: string; items: NavItem[] }[] = [
  {
    section: "Personal",
    items: [
      { screen: "member-inbox", label: "Inbox", icon: Bell },
      { screen: "member-profile", label: "My Profile", icon: User },
    ],
  },
  {
    section: "Assembly",
    items: [
      { screen: "member-groups", label: "Chats", icon: MessageSquare },
      { screen: "member-broadcasts", label: "Broadcasts", icon: Radio },
      { screen: "member-sermons", label: "Sermons", icon: BookOpen },
    ],
  },
  {
    section: "Account",
    items: [
      { screen: "member-settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ role }: { role: "admin" | "member" }) {
  const { screen, navigate, resetTo, user } = useApp();
  const sections = role === "admin" ? adminSidebarItems : memberSidebarItems;

  const isActive = (item: NavItem) => {
    if (screen === item.screen) return true;
    if (role === "admin") {
      if (item.screen === "admin-members" && screen.startsWith("admin-member")) return true;
      if (item.screen === "admin-groups" && screen.startsWith("admin-group")) return true;
      if (item.screen === "admin-broadcasts" && (screen.startsWith("admin-broadcast") || screen.startsWith("admin-sermon"))) return true;
    } else {
      if (item.screen === "member-groups" && screen === "member-group-chat") return true;
      if (item.screen === "member-broadcasts" && screen.startsWith("member-broadcast-detail")) return true;
      if (item.screen === "member-sermons" && screen === "member-sermon-detail") return true;
      if (item.screen === "member-profile" && screen === "member-profile-edit") return true;
    }
    return false;
  };

  return (
    <aside className="hidden md:flex flex-col w-60 bg-caci-blue text-white shrink-0 sticky top-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <CaciLogo size={36} />
        <div className="min-w-0">
          <p className="font-bold text-[16px] leading-tight">CACI Hub</p>
          <p className="text-[11px] text-white/70 leading-tight truncate">Assakae Central</p>
        </div>
      </div>

      {/* User chip */}
      {user && (
        <div className="mx-3 my-3 rounded-lg bg-white/10 px-3 py-2 flex items-center gap-2">
          <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-[12px] font-semibold">
            {user.fullName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium truncate">{user.fullName}</p>
            <p className="text-[11px] text-white/60 capitalize">{user.role}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-none px-2 pb-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-3">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {sec.section}
            </p>
            <ul className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <li key={item.screen}>
                    <button
                      onClick={() =>
                        item.screen === "admin-dashboard" || item.screen === "member-inbox"
                          ? resetTo(item.screen)
                          : navigate(item.screen)
                      }
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] font-medium transition-colors text-left",
                        active
                          ? "bg-white/15 text-white border-l-2 border-caci-red pl-[10px]"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sign Out Footer */}
      <SidebarSignOut />
    </aside>
  );
}

function SidebarSignOut() {
  const { setUser, resetTo } = useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // ignore — clear local state anyway
    } finally {
      setUser(null);
      resetTo("login");
    }
  };

  return (
    <>
      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[14px] font-medium transition-colors text-left text-white/70 hover:bg-white/10 hover:text-white group"
        >
          <LogOut size={18} className="shrink-0 group-hover:text-red-400 transition-colors" />
          Sign Out
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 size-12 rounded-full bg-caci-red-bg flex items-center justify-center">
              <LogOut size={22} className="text-caci-red" />
            </div>
            <AlertDialogTitle className="text-center text-[18px]">Sign Out?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[14px]">
              You will be returned to the login screen. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-col sm:flex-col gap-2">
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={loading}
              className="w-full bg-caci-red hover:bg-caci-red-dim text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Signing out…" : "Yes, Sign Out"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full border border-n100 text-n700 hover:bg-n50 font-medium py-2.5 rounded-lg transition-colors">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
// ============================================================
// CACI Top Header (mobile only) — shows brand + screen title
// ============================================================

export function MobileHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { back, user } = useApp();
  return (
    <header
      className="md:hidden sticky top-0 z-20 bg-caci-blue text-white px-4 py-3 flex items-center gap-3"
      style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
    >
      {onBack && (
        <button
          onClick={() => {
            onBack();
          }}
          className="-ml-1 size-9 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20"
          aria-label="Go back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[18px] font-bold leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[12px] text-white/70 truncate">{subtitle}</p>}
      </div>
      {user && !onBack && (
        <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-[12px] font-semibold">
          {user.fullName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
        </div>
      )}
    </header>
  );
}

// ============================================================
// CACI Desktop Top Bar
// ============================================================

export function DesktopTopBar({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-n100 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="size-9 flex items-center justify-center rounded-lg border border-n200 bg-n50 text-n700 hover:bg-n100 hover:text-n900 transition-colors"
            aria-label="Go back"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-[22px] font-bold text-n900">{title}</h1>
          {subtitle && <p className="text-[14px] text-n400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
