"use client";

import { useState } from "react";
import { BookOpen, Calendar, Mic, Music, Video, Image as ImageIcon, Info } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import {
  CACIButton, CACIInput, CACITextarea, CACICard, SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";

export function AdminSermonAdd() {
  const { back, resetTo } = useApp();
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!speaker.trim()) { setError("Speaker is required."); return; }
    if (!date) { setError("Date is required."); return; }
    setSaving(true);
    try {
      await api.sermons.create({
        title: title.trim(),
        speaker: speaker.trim(),
        date,
        description: description.trim() || undefined,
        scriptureReference: scriptureReference.trim() || undefined,
        audioUrl: audioUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      });
      toast.success("Sermon added to the library");
      resetTo("admin-sermons");
    } catch (e: any) {
      setError(e?.message || "Failed to add sermon");
      toast.error(e?.message || "Failed to add sermon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MobileHeader title="Add Sermon" onBack={back} />
      <DesktopTopBar
        title="Add Sermon"
        subtitle="Record a new message or teaching"
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" onClick={() => resetTo("admin-sermons")}>Cancel</CACIButton>
            <CACIButton size="sm" loading={saving} onClick={handleSave}>Add Sermon</CACIButton>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-2xl space-y-4">
        <CACICard>
          <SectionHeading title="Sermon Details" className="mb-4" />
          <div className="space-y-4">
            <CACIInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Power of the Cross"
              leftIcon={<BookOpen size={16} />}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CACIInput
                label="Speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="e.g. Pastor Emmanuel Mensah"
                leftIcon={<Mic size={16} />}
                required
              />
              <CACIInput
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                leftIcon={<Calendar size={16} />}
                required
              />
            </div>
            <CACIInput
              label="Scripture Reference (optional)"
              value={scriptureReference}
              onChange={(e) => setScriptureReference(e.target.value)}
              placeholder="e.g. 1 Corinthians 1:18"
            />
            <CACITextarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short summary of the message…"
              className="min-h-[100px]"
            />
          </div>
        </CACICard>

        <CACICard>
          <SectionHeading title="Media Links (optional)" className="mb-4" />
          <div className="space-y-4">
            <CACIInput
              label="Audio URL"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://…mp3"
              leftIcon={<Music size={16} />}
            />
            <CACIInput
              label="Video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/…"
              leftIcon={<Video size={16} />}
            />
            <CACIInput
              label="Cover Image URL"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://….jpg"
              leftIcon={<ImageIcon size={16} />}
            />
          </div>
        </CACICard>

        {error && (
          <div className="bg-caci-red-bg border border-caci-red/20 rounded-lg p-3 flex items-start gap-2">
            <Info size={16} className="text-caci-red shrink-0 mt-0.5" />
            <p className="text-[14px] text-caci-red">{error}</p>
          </div>
        )}

        <div className="md:hidden flex gap-3 pt-2">
          <CACIButton variant="secondary" className="flex-1" onClick={() => resetTo("admin-sermons")}>Cancel</CACIButton>
          <CACIButton className="flex-1" loading={saving} onClick={handleSave}>Add Sermon</CACIButton>
        </div>
      </div>
    </>
  );
}
