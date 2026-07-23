"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Search, Calendar, User, Mic, Play, Video, Music } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { SermonDTO } from "@/lib/types";
import { formatDate } from "@/lib/format";
import {
  CACIButton, CACICard, CACISkeleton, EmptyState, CACIInput,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";

export function AdminSermons() {
  const { navigate } = useApp();
  const [sermons, setSermons] = useState<SermonDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.sermons.list();
        if (mounted) setSermons(res.sermons);
      } catch {
        if (mounted) setSermons([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = (sermons || []).filter((s) =>
    !query.trim() ||
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.speaker.toLowerCase().includes(query.toLowerCase()) ||
    (s.scriptureReference || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <MobileHeader title="Sermons" subtitle={`${sermons?.length ?? 0} recorded`} />
      <DesktopTopBar
        title="Sermons"
        subtitle="Recorded messages and teachings"
        action={
          <CACIButton size="sm" leftIcon={<Plus size={15} />} onClick={() => navigate("admin-sermon-add")}>
            Add Sermon
          </CACIButton>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-5xl">
        <div className="mb-4">
          <CACIInput
            placeholder="Search sermons by title, speaker, scripture…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            containerClassName="mb-0"
          />
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CACICard key={i}>
                <CACISkeleton className="h-32 w-full rounded-md" />
                <div className="space-y-2 mt-3">
                  <CACISkeleton className="h-4 w-3/4" />
                  <CACISkeleton className="h-3 w-1/2" />
                </div>
              </CACICard>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<BookOpen size={26} />}
            title={query ? "No sermons match your search" : "No sermons yet"}
            description={query ? "Try a different search term." : "Add your first sermon to the library."}
            action={!query ? <CACIButton leftIcon={<Plus size={16} />} onClick={() => navigate("admin-sermon-add")}>Add Sermon</CACIButton> : undefined}
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <CACICard key={s.id} padding="none" className="overflow-hidden flex flex-col">
                {/* Cover */}
                <div className="h-32 bg-gradient-to-br from-caci-blue to-[#003578] flex items-center justify-center relative">
                  {s.coverImageUrl ? (
                    <img src={s.coverImageUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={40} className="text-white/80" />
                  )}
                  {s.audioUrl && (
                    <span className="absolute top-2 right-2 size-7 rounded-full bg-white/90 flex items-center justify-center">
                      <Music size={14} className="text-caci-blue" />
                    </span>
                  )}
                  {s.videoUrl && (
                    <span className="absolute top-2 right-2 size-7 rounded-full bg-white/90 flex items-center justify-center" style={{ right: s.audioUrl ? "2.75rem" : "0.5rem" }}>
                      <Video size={14} className="text-caci-red" />
                    </span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-[12px] text-caci-blue font-medium">{formatDate(s.date)}</p>
                  <h3 className="font-semibold text-n900 text-[16px] leading-snug mt-1 line-clamp-2">{s.title}</h3>
                  <p className="text-[13px] text-n500 mt-1 flex items-center gap-1">
                    <Mic size={12} /> {s.speaker}
                  </p>
                  {s.scriptureReference && (
                    <p className="text-[12px] text-n400 mt-1 italic">📖 {s.scriptureReference}</p>
                  )}
                  {s.description && (
                    <p className="text-[13px] text-n500 mt-2 line-clamp-2 flex-1">{s.description}</p>
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
