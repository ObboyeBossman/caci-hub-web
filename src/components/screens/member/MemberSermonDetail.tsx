"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, Mic, Music, Video, ExternalLink, ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { SermonDTO } from "@/lib/types";
import { formatDate } from "@/lib/format";
import {
  CACICard, CACISkeleton, EmptyState, CACIButton,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";

export function MemberSermonDetail() {
  const { params, back } = useApp();
  const sermonId = params.sermonId;
  const [sermon, setSermon] = useState<SermonDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sermonId) { back(); return; }
    let mounted = true;
    (async () => {
      try {
        const res = await api.sermons.get(sermonId);
        if (mounted) setSermon(res.sermon);
      } catch {} finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [sermonId, back]);

  if (loading) {
    return (
      <>
        <MobileHeader title="Sermon" onBack={back} />
        <DesktopTopBar title="Sermon" />
        <div className="px-4 py-4 max-w-md mx-auto md:max-w-3xl space-y-4">
          <CACISkeleton className="h-48 w-full rounded-lg" />
          <CACISkeleton className="h-6 w-3/4" />
          <CACISkeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (!sermon) {
    return (
      <>
        <MobileHeader title="Sermon" onBack={back} />
        <DesktopTopBar title="Sermon" />
        <EmptyState title="Sermon not found" action={<CACIButton onClick={back}>Go back</CACIButton>} />
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Sermon" onBack={back} />
      <DesktopTopBar title={sermon.title} subtitle={`${sermon.speaker} · ${formatDate(sermon.date)}`} />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl space-y-4">
        {/* Cover */}
        <div className="h-48 md:h-64 rounded-lg overflow-hidden bg-gradient-to-br from-caci-blue to-[#003578] flex items-center justify-center relative">
          {sermon.coverImageUrl ? (
            <img src={sermon.coverImageUrl} alt={sermon.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={56} className="text-white/80" />
          )}
        </div>

        <CACICard padding="lg">
          <p className="text-[12px] text-caci-blue font-medium uppercase tracking-wide">{formatDate(sermon.date)}</p>
          <h1 className="text-[22px] font-bold text-n900 leading-tight mt-1">{sermon.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-[14px] text-n500">
            <Mic size={14} />
            <span>{sermon.speaker}</span>
          </div>
          {sermon.scriptureReference && (
            <div className="mt-3 inline-flex items-center gap-2 bg-caci-blue-bg text-caci-blue px-3 py-1.5 rounded-md text-[14px] font-medium">
              📖 {sermon.scriptureReference}
            </div>
          )}
          {sermon.description && (
            <div className="mt-4 text-[15px] text-n700 leading-relaxed whitespace-pre-wrap">
              {sermon.description}
            </div>
          )}
        </CACICard>

        {/* Media */}
        {(sermon.audioUrl || sermon.videoUrl) && (
          <CACICard>
            <h3 className="text-[16px] font-semibold text-n900 mb-3">Listen / Watch</h3>
            <div className="space-y-2">
              {sermon.audioUrl && (
                <a href={sermon.audioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-n100 hover:border-caci-blue transition-colors">
                  <div className="size-10 rounded-lg bg-caci-blue-bg text-caci-blue flex items-center justify-center shrink-0">
                    <Music size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-n900">Audio</p>
                    <p className="text-[12px] text-n400 truncate">Listen to the message</p>
                  </div>
                  <ExternalLink size={16} className="text-n400" />
                </a>
              )}
              {sermon.videoUrl && (
                <a href={sermon.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-n100 hover:border-caci-blue transition-colors">
                  <div className="size-10 rounded-lg bg-caci-red-bg text-caci-red flex items-center justify-center shrink-0">
                    <Video size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-n900">Video</p>
                    <p className="text-[12px] text-n400 truncate">Watch the message</p>
                  </div>
                  <ExternalLink size={16} className="text-n400" />
                </a>
              )}
            </div>
          </CACICard>
        )}
      </div>
    </>
  );
}
