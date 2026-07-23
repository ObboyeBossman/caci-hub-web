"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UsersRound,
  Radio,
  Plus,
  Send,
  BookOpen,
  ScrollText,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { DashboardStatsDTO } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import {
  CACIButton,
  CACICard,
  CaciAvatar,
  CACISkeleton,
  EmptyState,
  SectionHeading,
  StatTile,
  MembershipStatusBadge,
  TargetingBadge,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";

export function AdminDashboard() {
  const { user, navigate, setParam } = useApp();
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.dashboard.get();
        if (mounted) {
          setStats(res.stats);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const firstName = user?.fullName?.split(" ").slice(-1)[0] || "Pastor";

  const goToMember = (id: string) => {
    setParam("memberId", id);
    navigate("admin-member-detail");
  };

  return (
    <>
      <MobileHeader title="Dashboard" subtitle="Assakae Central Assembly" />
      <DesktopTopBar
        title="Dashboard"
        subtitle="Assakae Central Assembly"
        action={
          <CACIButton
            size="sm"
            leftIcon={<Send size={15} />}
            onClick={() => navigate("admin-broadcast-compose")}
          >
            Send Broadcast
          </CACIButton>
        }
      />

      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-6xl animate-fade-in">
        {/* Welcome banner */}
        <CACICard padding="lg" className="mb-4 bg-gradient-to-br from-caci-blue to-caci-blue-dim text-white border-0">
          <p className="text-[14px] text-white/80">Welcome back,</p>
          <h2 className="text-[20px] font-bold leading-tight">Pastor {firstName} 🙏</h2>
          <div className="mt-3 pt-3 border-t border-white/15">
            <p className="text-[13px] italic text-white/90">
              &ldquo;The Lord bless thee, and keep thee.&rdquo;
            </p>
            <p className="text-[11px] text-white/60 mt-0.5">— Numbers 6:24</p>
          </div>
        </CACICard>

        {error && (
          <CACICard className="mb-4 border-caci-red/30 bg-caci-red-bg">
            <p className="text-[14px] text-caci-red">{error}</p>
          </CACICard>
        )}

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[...Array(4)].map((_, i) => (
              <CACISkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatTile
              label="Total Members"
              value={stats?.totalMembers ?? 0}
              icon={<Users size={20} />}
              accent="red"
              onClick={() => navigate("admin-members")}
            />
            <StatTile
              label="Active Members"
              value={stats?.activeMembers ?? 0}
              icon={<UserCheck size={20} />}
              accent="green"
              trend={
                stats && stats.totalMembers > 0
                  ? { value: `${Math.round((stats.activeMembers / stats.totalMembers) * 100)}% of total`, positive: true }
                  : undefined
              }
            />
            <StatTile
              label="Total Groups"
              value={stats?.totalGroups ?? 0}
              icon={<UsersRound size={20} />}
              accent="blue"
              onClick={() => navigate("admin-groups")}
            />
            <StatTile
              label="Broadcasts (7d)"
              value={stats?.broadcastsThisWeek ?? 0}
              icon={<Radio size={20} />}
              accent="amber"
              onClick={() => navigate("admin-broadcasts")}
            />
          </div>
        )}

        {/* Member status breakdown */}
        {!loading && stats && (
          <CACICard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-n700">Member Status</p>
              <span className="text-[12px] text-n400">{stats.totalMembers} total</span>
            </div>
            {/* Horizontal bar */}
            {stats.totalMembers > 0 ? (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-n50 mb-3">
                  <div
                    className="bg-[#1a7f37]"
                    style={{ width: `${(stats.activeMembers / stats.totalMembers) * 100}%` }}
                    title="Active"
                  />
                  <div
                    className="bg-[#9a6700]"
                    style={{ width: `${(stats.visitorCount / stats.totalMembers) * 100}%` }}
                    title="Visitors"
                  />
                  <div
                    className="bg-n300"
                    style={{ width: `${(stats.inactiveCount / stats.totalMembers) * 100}%` }}
                    title="Inactive"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatusMini label="Active" count={stats.activeMembers} color="#1a7f37" />
                  <StatusMini label="Visitors" count={stats.visitorCount} color="#9a6700" />
                  <StatusMini label="Inactive" count={stats.inactiveCount} color="#6e7681" />
                </div>
              </>
            ) : (
              <p className="text-[13px] text-n400">No members yet.</p>
            )}
          </CACICard>
        )}

        {/* Member growth chart */}
        {!loading && stats && stats.memberGrowth && stats.memberGrowth.length > 0 && (
          <CACICard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-n700">Member Growth (6 months)</p>
              <TrendingUp size={16} className="text-[#1a7f37]" />
            </div>
            <GrowthChart data={stats.memberGrowth} />
          </CACICard>
        )}

        {/* Quick actions */}
        <div className="mb-4">
          <SectionHeading title="Quick Actions" className="mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction
              label="Add Member"
              icon={<Plus size={18} />}
              accent="red"
              onClick={() => navigate("admin-member-add")}
            />
            <QuickAction
              label="Send Broadcast"
              icon={<Send size={18} />}
              accent="blue"
              onClick={() => navigate("admin-broadcast-compose")}
            />
            <QuickAction
              label="Add Sermon"
              icon={<BookOpen size={18} />}
              accent="green"
              onClick={() => navigate("admin-sermon-add")}
            />
            <QuickAction
              label="Audit Log"
              icon={<ScrollText size={18} />}
              accent="amber"
              onClick={() => navigate("admin-audit")}
            />
          </div>
        </div>

        {/* Recent members */}
        <div className="mb-4">
          <SectionHeading
            title="Recent Members"
            action={
              <button
                onClick={() => navigate("admin-members")}
                className="text-[13px] font-medium text-caci-blue hover:underline flex items-center gap-0.5"
              >
                View all <ArrowRight size={13} />
              </button>
            }
            className="mb-3"
          />
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <CACISkeleton key={i} className="h-16" />
              ))}
            </div>
          ) : stats && stats.recentMembers && stats.recentMembers.length > 0 ? (
            <div className="space-y-2">
              {stats.recentMembers.slice(0, 5).map((m) => (
                <CACICard
                  key={m.id}
                  hover
                  padding="sm"
                  className="flex items-center gap-3"
                  onClick={() => goToMember(m.id)}
                >
                  <CaciAvatar name={m.fullName} photoUrl={m.profilePhotoUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-n900 truncate">{m.fullName}</p>
                    <p className="text-[12px] text-n400 truncate">
                      {m.assemblyRole || "Member"} · Joined {formatRelative(m.joinDate || m.createdAt)}
                    </p>
                  </div>
                  <MembershipStatusBadge status={m.membershipStatus} />
                </CACICard>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={20} />}
              title="No members yet"
              description="Newly added members will appear here."
            />
          )}
        </div>

        {/* Recent broadcasts */}
        <div>
          <SectionHeading
            title="Recent Broadcasts"
            action={
              <button
                onClick={() => navigate("admin-broadcasts")}
                className="text-[13px] font-medium text-caci-blue hover:underline flex items-center gap-0.5"
              >
                View all <ArrowRight size={13} />
              </button>
            }
            className="mb-3"
          />
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <CACISkeleton key={i} className="h-20" />
              ))}
            </div>
          ) : stats && stats.recentBroadcasts && stats.recentBroadcasts.length > 0 ? (
            <div className="space-y-2">
              {stats.recentBroadcasts.slice(0, 5).map((b) => (
                <CACICard key={b.id} padding="default">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[14px] font-semibold text-n900 line-clamp-1 flex-1">{b.title}</p>
                    <TargetingBadge mode={b.targetingMode} />
                  </div>
                  <p className="text-[13px] text-n500 line-clamp-2 mb-1.5">{b.body}</p>
                  <p className="text-[11px] text-n400">
                    {b.sentByName || "Admin"} · {formatRelative(b.sentAt)}
                    {b.targetGroupName ? ` · ${b.targetGroupName}` : ""}
                  </p>
                </CACICard>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Radio size={20} />}
              title="No broadcasts yet"
              description="Send your first broadcast to reach the assembly."
            />
          )}
        </div>
      </div>
    </>
  );
}

function StatusMini({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-md bg-n50 px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-n400">{label}</span>
      </div>
      <p className="text-[16px] font-bold text-n900 mt-0.5">{count}</p>
    </div>
  );
}

function GrowthChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * 100, 4);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
              <div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-caci-blue to-caci-blue-light transition-all"
                style={{ height: `${h}%` }}
                title={`${d.value} new member(s)`}
              />
            </div>
            <span className="text-[10px] text-n400">{d.label}</span>
            <span className="text-[11px] font-semibold text-n700">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuickAction({
  label,
  icon,
  accent,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  accent: "red" | "blue" | "green" | "amber";
  onClick: () => void;
}) {
  const accentClasses = {
    red: "bg-caci-red-bg text-caci-red",
    blue: "bg-caci-blue-bg text-caci-blue",
    green: "bg-[#dafbe1] text-[#1a7f37]",
    amber: "bg-[#fff8c5] text-[#9a6700]",
  }[accent];
  return (
    <CACICard hover padding="default" onClick={onClick} className="flex flex-col items-center justify-center gap-2 text-center">
      <div className={cn("flex size-10 items-center justify-center rounded-lg", accentClasses)}>
        {icon}
      </div>
      <span className="text-[13px] font-semibold text-n700">{label}</span>
    </CACICard>
  );
}
