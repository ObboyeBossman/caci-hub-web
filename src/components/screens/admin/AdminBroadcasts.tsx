"use client";

import { useEffect, useState } from "react";
import { Radio, Plus, Send, Search, Paperclip } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { BroadcastDTO } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import {
  CACIButton, CACICard, CACISkeleton, EmptyState, TargetingBadge, CACIInput,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";

export function AdminBroadcasts() {
  const { navigate, setParam } = useApp();
  const [broadcasts, setBroadcasts] = useState<BroadcastDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.broadcasts.list();
        if (mounted) setBroadcasts(res.broadcasts);
      } catch {
        if (mounted) setBroadcasts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = (broadcasts || []).filter((b) =>
    !query.trim() ||
    b.title.toLowerCase().includes(query.toLowerCase()) ||
    b.body.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <MobileHeader title="Broadcasts" subtitle={`${broadcasts?.length ?? 0} sent`} />
      <DesktopTopBar
        title="Broadcasts"
        subtitle="One-way announcements to the assembly"
        action={
          <CACIButton size="sm" leftIcon={<Plus size={15} />} onClick={() => navigate("admin-broadcast-compose")}>
            Compose Broadcast
          </CACIButton>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-4xl">
        <div className="mb-4">
          <CACIInput
            placeholder="Search broadcasts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            containerClassName="mb-0"
          />
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <CACICard key={i}>
                <div className="space-y-2">
                  <CACISkeleton className="h-4 w-1/3" />
                  <CACISkeleton className="h-5 w-3/4" />
                  <CACISkeleton className="h-3 w-full" />
                  <CACISkeleton className="h-3 w-1/2" />
                </div>
              </CACICard>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<Radio size={26} />}
            title={query ? "No broadcasts match your search" : "No broadcasts yet"}
            description={query ? "Try a different search term." : "Send your first announcement to the assembly."}
            action={!query ? <CACIButton leftIcon={<Send size={16} />} onClick={() => navigate("admin-broadcast-compose")}>Compose Broadcast</CACIButton> : undefined}
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((b) => (
              <CACICard key={b.id} hover onClick={() => { setParam("broadcastId", b.id); navigate("admin-broadcasts"); }} className="block">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <TargetingBadge mode={b.targetingMode} />
                  <span className="text-[12px] text-n400 shrink-0">{formatRelative(b.sentAt)}</span>
                </div>
                <h3 className="font-semibold text-n900 text-[16px] leading-snug">{b.title}</h3>
                <p className="text-[14px] text-n500 mt-1 line-clamp-2">{b.body}</p>
                <div className="flex items-center gap-2 mt-2 text-[12px] text-n400">
                  <span>By {b.sentByName || "Admin"}</span>
                  {b.targetGroupName && <span>· To: {b.targetGroupName}</span>}
                  {b.attachmentUrl && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip size={11} /> attachment
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
