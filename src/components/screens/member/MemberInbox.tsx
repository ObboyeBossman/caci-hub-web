"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, Inbox, Radio } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { NotificationDTO } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import {
  CACIButton, CACICard, CACISkeleton, EmptyState,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";

export function MemberInbox() {
  const { user, setParam, navigate } = useApp();
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.memberId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.notifications.list(user.memberId);
      setNotifications(res.notifications);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = async () => {
    if (!user?.memberId) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead(user.memberId);
      setNotifications((n) => (n || []).map((x) => ({ ...x, isRead: true })));
    } catch {} finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((n) => (n || []).map((x) => x.id === id ? { ...x, isRead: true } : x));
    } catch {}
  };

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  return (
    <>
      <MobileHeader
        title="Inbox"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      />
      <DesktopTopBar
        title="Inbox"
        subtitle={unreadCount > 0 ? `You have ${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}` : "You're all caught up"}
        action={
          unreadCount > 0 ? (
            <CACIButton size="sm" variant="secondary" leftIcon={<CheckCheck size={15} />} loading={markingAll} onClick={handleMarkAllRead}>
              Mark all read
            </CACIButton>
          ) : undefined
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl">
        {/* Quick stats / banner */}
        {unreadCount > 0 && (
          <div className="md:hidden bg-caci-red-bg border border-caci-red/20 rounded-lg p-3 mb-3 flex items-center gap-2">
            <Bell size={16} className="text-caci-red" />
            <p className="text-[13px] text-caci-red font-medium">{unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}</p>
            <button onClick={handleMarkAllRead} className="ml-auto text-[12px] text-caci-red font-semibold hover:underline">
              Mark all
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <CACICard key={i} className="flex items-start gap-3">
                <CACISkeleton className="size-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <CACISkeleton className="h-4 w-3/4" />
                  <CACISkeleton className="h-3 w-full" />
                  <CACISkeleton className="h-3 w-1/3" />
                </div>
              </CACICard>
            ))}
          </div>
        )}

        {!loading && (notifications || []).length === 0 && (
          <EmptyState
            icon={<Inbox size={26} />}
            title="No notifications"
            description="When your assembly sends broadcasts, they will appear here."
          />
        )}

        {!loading && (notifications || []).length > 0 && (
          <div className="space-y-2">
            {(notifications || []).map((n) => (
              <CACICard
                key={n.id}
                hover
                onClick={() => {
                  if (!n.isRead) handleMarkRead(n.id);
                  if (n.broadcastId) {
                    setParam("broadcastId", n.broadcastId);
                    navigate("member-broadcast-detail");
                  }
                }}
                className={cn("flex items-start gap-3", !n.isRead && "border-l-4 border-l-caci-red")}
              >
                <div className={cn(
                  "size-10 rounded-lg flex items-center justify-center shrink-0",
                  n.isRead ? "bg-n50 text-n400" : "bg-caci-red-bg text-caci-red",
                )}>
                  <Radio size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-[15px] leading-snug", n.isRead ? "font-medium text-n700" : "font-semibold text-n900")}>
                      {n.title}
                    </p>
                    {!n.isRead && <span className="size-2 rounded-full bg-caci-red shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[13px] text-n500 mt-1 line-clamp-2">{n.body}</p>
                  <p className="text-[12px] text-n400 mt-1">{formatRelative(n.createdAt)}</p>
                </div>
              </CACICard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
