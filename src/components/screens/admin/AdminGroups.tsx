"use client";

import { useEffect, useState, useCallback } from "react";
import { UsersRound, Plus, Search, Crown, Lock, Unlock, Archive } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { GroupDTO } from "@/lib/types";
import {
  CACIButton, CACICard, CACISkeleton, EmptyState, CACIInput,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";

const filters = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "restricted", label: "Restricted" },
  { key: "archived", label: "Archived" },
] as const;

export function AdminGroups() {
  const { navigate, setParam } = useApp();
  const [groups, setGroups] = useState<GroupDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const includeInactive = filter === "archived" || filter === "all";
      const res = await api.groups.list({ includeInactive });
      let list = res.groups;
      if (filter === "open") list = list.filter((g) => g.messagingMode === "open" && g.isActive);
      if (filter === "restricted") list = list.filter((g) => g.messagingMode === "restricted" && g.isActive);
      if (filter === "archived") list = list.filter((g) => !g.isActive);
      if (query.trim()) {
        const q = query.toLowerCase();
        list = list.filter((g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description || "").toLowerCase().includes(q) ||
          (g.leaderName || "").toLowerCase().includes(q)
        );
      }
      setGroups(list);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const goToDetail = (id: string) => {
    setParam("groupId", id);
    navigate("admin-group-detail");
  };

  const count = groups?.length ?? 0;

  return (
    <>
      <MobileHeader title="Groups" subtitle={`${count} ${count === 1 ? "group" : "groups"}`} />
      <DesktopTopBar
        title="Groups"
        subtitle={`${count} ${count === 1 ? "group" : "groups"} in the assembly`}
        action={
          <CACIButton size="sm" leftIcon={<Plus size={15} />} onClick={() => navigate("admin-group-add")}>
            New Group
          </CACIButton>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-6xl">
        <div className="space-y-3 mb-4">
          <CACIInput
            placeholder="Search groups by name or leader…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            containerClassName="mb-0"
          />
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  filter === f.key
                    ? "bg-caci-blue text-white border-caci-blue"
                    : "bg-white text-n500 border-n100 hover:border-caci-blue hover:text-caci-blue",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CACICard key={i}>
                <div className="flex items-start gap-3">
                  <CACISkeleton className="size-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <CACISkeleton className="h-4 w-3/4" />
                    <CACISkeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <CACISkeleton className="h-3 w-full mt-3" />
              </CACICard>
            ))}
          </div>
        )}

        {!loading && count === 0 && (
          <EmptyState
            icon={<UsersRound size={26} />}
            title="No groups found"
            description="Create your first group to organise members into fellowships and ministries."
            action={<CACIButton leftIcon={<Plus size={16} />} onClick={() => navigate("admin-group-add")}>New Group</CACIButton>}
          />
        )}

        {!loading && count > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups!.map((g) => (
              <CACICard key={g.id} as="button" hover onClick={() => goToDetail(g.id)} className="text-left flex flex-col">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "size-11 rounded-lg flex items-center justify-center shrink-0",
                    g.isActive ? "bg-caci-blue-bg text-caci-blue" : "bg-n50 text-n400",
                  )}>
                    <UsersRound size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-n900 truncate">{g.name}</p>
                      {!g.isActive && <Archive size={14} className="text-n400 shrink-0" />}
                    </div>
                    <p className="text-[12px] text-n400 truncate">
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                {g.description && (
                  <p className="text-[13px] text-n500 mt-3 line-clamp-2">{g.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {g.messagingMode === "restricted" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-[#fff8c5] text-[#9a6700] px-2 py-0.5 rounded-md font-medium">
                      <Lock size={11} /> Restricted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-caci-blue-bg text-caci-blue px-2 py-0.5 rounded-md font-medium">
                      <Unlock size={11} /> Open
                    </span>
                  )}
                  {g.leaderName && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-n500">
                      <Crown size={11} className="text-caci-red" /> {g.leaderName}
                    </span>
                  )}
                </div>
              </CACICard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
