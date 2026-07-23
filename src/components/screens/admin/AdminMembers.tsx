"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Plus, Search, ChevronRight, Filter, UserPlus,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { MemberDTO, MembershipStatus } from "@/lib/types";
import { formatDate, formatPhoneDisplay } from "@/lib/format";
import {
  CACIButton, CACICard, CaciAvatar, CACISkeleton, EmptyState,
  MembershipStatusBadge, CACIInput,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";

const statusFilters: { key: "" | MembershipStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "visitor", label: "Visitors" },
  { key: "inactive", label: "Inactive" },
];

export function AdminMembers() {
  const { navigate, setParam } = useApp();
  const [members, setMembers] = useState<MemberDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"" | MembershipStatus>("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.members.list({
        q: debounced || undefined,
        status: status || undefined,
        includeDeleted: showDeleted,
      });
      setMembers(res.members);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, status, showDeleted]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const goToDetail = (id: string) => {
    setParam("memberId", id);
    navigate("admin-member-detail");
  };

  const count = members?.length ?? 0;

  return (
    <>
      <MobileHeader title="Members" subtitle={`${count} total`} />
      <DesktopTopBar
        title="Members"
        subtitle={`${count} ${count === 1 ? "member" : "members"} in the assembly`}
        action={
          <CACIButton
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => navigate("admin-member-add")}
          >
            Add Member
          </CACIButton>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-6xl">
        {/* Search + filter row */}
        <div className="space-y-3 mb-4">
          <CACIInput
            placeholder="Search by name, number, phone, role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            containerClassName="mb-0"
          />
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {statusFilters.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                  status === f.key
                    ? "bg-caci-blue text-white border-caci-blue"
                    : "bg-white text-n500 border-n100 hover:border-caci-blue hover:text-caci-blue",
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setShowDeleted((s) => !s)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ml-auto",
                showDeleted
                  ? "bg-caci-red-bg text-caci-red border-caci-red/30"
                  : "bg-white text-n500 border-n100 hover:border-caci-red hover:text-caci-red",
              )}
            >
              {showDeleted ? "Showing deleted" : "Show deleted"}
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <CACICard key={i} className="flex items-center gap-3">
                <CACISkeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <CACISkeleton className="h-4 w-2/3" />
                  <CACISkeleton className="h-3 w-1/2" />
                </div>
                <CACISkeleton className="size-5" />
              </CACICard>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && count === 0 && (
          <EmptyState
            icon={<Users size={26} />}
            title="No members found"
            description={
              debounced || status
                ? "Try adjusting your search or filters."
                : "Add your first member to get started."
            }
            action={
              <CACIButton
                leftIcon={<UserPlus size={16} />}
                onClick={() => navigate("admin-member-add")}
              >
                Add Member
              </CACIButton>
            }
          />
        )}

        {/* Mobile: cards */}
        {!loading && count > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {members!.map((m) => (
                <CACICard
                  key={m.id}
                  as="button"
                  hover
                  onClick={() => goToDetail(m.id)}
                  className="flex items-center gap-3 text-left"
                >
                  <CaciAvatar name={m.fullName} photoUrl={m.profilePhotoUrl} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-n900 truncate">
                        {m.title ? `${m.title} ` : ""}{m.fullName}
                      </p>
                      {m.deletedAt && (
                        <span className="text-[10px] text-caci-red font-medium">DELETED</span>
                      )}
                    </div>
                    <p className="text-[12px] text-n400 truncate">
                      {m.membershipNumber || "No membership number"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <MembershipStatusBadge status={m.membershipStatus} />
                      {m.assemblyRole && (
                        <span className="text-[12px] text-n500 truncate">· {m.assemblyRole}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-n300 shrink-0" />
                </CACICard>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <div className="bg-white rounded-lg border border-n100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-n50 border-b border-n100">
                    <tr className="text-[12px] font-semibold text-n400 uppercase tracking-wide">
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Groups</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-n100">
                    {members!.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => goToDetail(m.id)}
                        className="hover:bg-n50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CaciAvatar name={m.fullName} photoUrl={m.profilePhotoUrl} size={36} />
                            <div>
                              <p className="font-semibold text-n900 text-[14px]">
                                {m.title ? `${m.title} ` : ""}{m.fullName}
                              </p>
                              <p className="text-[12px] text-n400">{m.membershipNumber || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><MembershipStatusBadge status={m.membershipStatus} /></td>
                        <td className="px-4 py-3 text-[14px] text-n500">{m.assemblyRole || "—"}</td>
                        <td className="px-4 py-3 text-[14px] text-n500">{formatPhoneDisplay(m.phoneNumber)}</td>
                        <td className="px-4 py-3 text-[14px] text-n500">{formatDate(m.joinDate)}</td>
                        <td className="px-4 py-3 text-[14px] text-n500">{m.groupCount ?? 0}</td>
                        <td className="px-4 py-3"><ChevronRight size={16} className="text-n300" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
