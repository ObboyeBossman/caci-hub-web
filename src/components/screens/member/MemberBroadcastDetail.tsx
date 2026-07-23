"use client";

import { useEffect, useState } from "react";
import { Radio, Paperclip, Send, Calendar } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { BroadcastDTO } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import {
  CACICard, CACISkeleton, EmptyState, TargetingBadge, CACIButton,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";

export function MemberBroadcastDetail() {
  const { params, back } = useApp();
  const broadcastId = params.broadcastId;
  const [broadcast, setBroadcast] = useState<BroadcastDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!broadcastId) { back(); return; }
    let mounted = true;
    (async () => {
      try {
        const res = await api.broadcasts.get(broadcastId);
        if (mounted) setBroadcast(res.broadcast);
      } catch {} finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [broadcastId, back]);

  if (loading) {
    return (
      <>
        <MobileHeader title="Broadcast" onBack={back} />
        <DesktopTopBar title="Broadcast" />
        <div className="px-4 py-4 max-w-md mx-auto md:max-w-3xl space-y-4">
          <CACISkeleton className="h-8 w-3/4" />
          <CACISkeleton className="h-4 w-1/3" />
          <CACISkeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (!broadcast) {
    return (
      <>
        <MobileHeader title="Broadcast" onBack={back} />
        <DesktopTopBar title="Broadcast" />
        <EmptyState title="Broadcast not found" action={<CACIButton onClick={back}>Go back</CACIButton>} />
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Broadcast" onBack={back} />
      <DesktopTopBar title={broadcast.title} subtitle={`Sent ${formatDateTime(broadcast.sentAt)}`} />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl">
        <CACICard padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <TargetingBadge mode={broadcast.targetingMode} />
            {broadcast.targetGroupName && (
              <span className="text-[12px] text-n400">to {broadcast.targetGroupName}</span>
            )}
          </div>
          <h1 className="text-[22px] font-bold text-n900 leading-tight">{broadcast.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-[13px] text-n400">
            <div className="size-8 rounded-full bg-caci-blue-bg text-caci-blue flex items-center justify-center">
              <Radio size={16} />
            </div>
            <div>
              <p className="font-medium text-n700">{broadcast.sentByName || "Assembly"}</p>
              <p className="text-[12px]">{formatDateTime(broadcast.sentAt)}</p>
            </div>
          </div>
          <div className="mt-4 prose prose-sm max-w-none">
            <p className="text-[15px] text-n700 leading-relaxed whitespace-pre-wrap">{broadcast.body}</p>
          </div>
          {broadcast.attachmentUrl && (
            <a
              href={broadcast.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-3 p-3 rounded-lg border border-n100 hover:border-caci-blue transition-colors"
            >
              <div className="size-10 rounded-lg bg-caci-blue-bg text-caci-blue flex items-center justify-center shrink-0">
                <Paperclip size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-n900 truncate">View attachment</p>
                <p className="text-[12px] text-n400 truncate">{broadcast.attachmentUrl}</p>
              </div>
            </a>
          )}
        </CACICard>
      </div>
    </>
  );
}
