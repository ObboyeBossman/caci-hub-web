"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser } from "@/lib/types";

// ============================================================
// CACI Hub — App Router Store
// State-based SPA navigation (single `/` route per sandbox constraint)
// ============================================================

export type AdminScreen =
  | "admin-dashboard"
  | "admin-members"
  | "admin-member-detail"
  | "admin-member-edit"
  | "admin-member-add"
  | "admin-groups"
  | "admin-group-detail"
  | "admin-group-add"
  | "admin-broadcasts"
  | "admin-broadcast-compose"
  | "admin-sermons"
  | "admin-sermon-add"
  | "admin-accounts"
  | "admin-settings"
  | "admin-audit"
  | "admin-forum";

export type MemberScreen =
  | "member-inbox"
  | "member-groups"
  | "member-group-chat"
  | "member-broadcasts"
  | "member-broadcast-detail"
  | "member-sermons"
  | "member-sermon-detail"
  | "member-profile"
  | "member-profile-edit"
  | "member-forum"
  | "member-settings";

export type Screen = "login" | "admin" | "member" | AdminScreen | MemberScreen;

interface AppState {
  // session
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;

  // navigation
  screen: Screen;
  stack: Screen[];
  navigate: (s: Screen) => void;
  back: () => void;
  resetTo: (s: Screen) => void;

  // contextual params (e.g. selected member id, group id, broadcast id)
  params: Record<string, string | undefined>;
  setParam: (key: string, value: string | undefined) => void;
  clearParams: () => void;

  // ui state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (u) => set({ user: u }),

      screen: "login",
      stack: [],
      navigate: (s) => {
        const { screen, stack } = get();
        set({ screen: s, stack: [...stack, screen] });
        // scroll to top on navigation
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      back: () => {
        const { stack } = get();
        if (stack.length === 0) return;
        const newStack = [...stack];
        const prev = newStack.pop()!;
        set({ screen: prev, stack: newStack });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      resetTo: (s) => set({ screen: s, stack: [] }),

      params: {},
      setParam: (key, value) =>
        set((state) => ({ params: { ...state.params, [key]: value } })),
      clearParams: () => set({ params: {} }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "caci-hub-store",
      // Don't persist user (session is in httpOnly cookie); only persist non-sensitive UI state.
      partialize: (state) => ({
        screen: state.screen,
        stack: state.stack,
      }),
    },
  ),
);
