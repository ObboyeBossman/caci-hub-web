"use client";

import { useEffect, useState } from "react";
import { Radio, Paperclip, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { BroadcastDTO } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import {
  CACICard, CACISkeleton, EmptyState, TargetingBadge,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";

export function MemberBroadcasts() {
  const { user, navigate, setParam } = useApp();
  const [broadcasts, setBroadcasts] = useState<BroadcastDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.broadcasts.list(user?.memberId);
        if (mounted) setBroadcasts(res.broadcasts);
      } catch {
        if (mounted) setBroadcasts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.memberId]);

  return (
    <>
      <MobileHeader title="Broadcasts" subtitle={`${broadcasts?.length ?? 0} received`} />
      <DesktopTopBar title="Broadcasts" subtitle="Announcements from your assembly" />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <CACICard key={i}>
                <div className="space-y-2">
                  <CACISkeleton className="h-4 w-1/3" />
                  <CACISkeleton className="h-5 w-3/4" />
                  <CACISkeleton className="h-3 w-full" />
                </div>
              </CACICard>
            ))}
          </div>
        )}

        {!loading && (broadcasts || []).length === 0 && (
          <EmptyState
            icon={<Radio size={26} />}
            title="No broadcasts yet"
            description="When your assembly sends announcements, they will appear here."
          />
        )}

        {!loading && (broadcasts || []).length > 0 && (
          <div className="space-y-3">
            {(broadcasts || []).map((b) => (
              <CACICard
                key={b.id}
                hover
                onClick={() => { setParam("broadcastId", b.id); navigate("member-broadcast-detail"); }}
                className="block"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <TargetingBadge mode={b.targetingMode} />
                  <span className="text-[12px] text-n400 shrink-0">{formatRelative(b.sentAt)}</span>
                </div>
                <h3 className="font-semibold text-n900 text-[16px] leading-snug">{b.title}</h3>
                <p className="text-[14px] text-n500 mt-1 line-clamp-2">{b.body}</p>
                <div className="flex items-center justify-between mt-2 text-[12px] text-n400">
                  <span>By {b.sentByName || "Assembly"}</span>
                  <ChevronRight size={14} className="text-n300" />
                </div>
              </CACICard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
