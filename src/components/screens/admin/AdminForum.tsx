"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2, MessageSquare, AlertCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { ForumMessageDTO } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import {
  CACIButton,
  CACICard,
  CaciAvatar,
  CACITextarea,
  CACISkeleton,
  EmptyState,
  RoleBadge,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminForum() {
  const { user } = useApp();
  const [messages, setMessages] = useState<ForumMessageDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        const res = await api.forum.list();
        if (mounted) setMessages(res.messages);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load forum");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePost = async () => {
    const content = draft.trim();
    if (!content) return;
    if (posting) return;

    setPosting(true);
    // Optimistic placeholder (no id yet, will be replaced with real)
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ForumMessageDTO = {
      id: optimisticId,
      memberId: user?.memberId || "self",
      memberName: user?.fullName || "You",
      memberRole: "Admin",
      memberTitle: null,
      content,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((prev) => (prev ? [...prev, optimistic] : [optimistic]));
    setDraft("");

    try {
      const res = await api.forum.post(content);
      setMessages((prev) =>
        prev ? prev.map((m) => (m.id === optimisticId ? res.message : m)) : [res.message],
      );
      // scroll to bottom
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      // Revert
      setMessages((prev) => (prev ? prev.filter((m) => m.id !== optimisticId) : prev));
      setError(e?.message || "Failed to post message");
      setDraft(content); // restore draft
      toast.error(e?.message || "Failed to post message");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    const target = messages?.find((m) => m.id === id);
    if (!target) return;
    setDeletingId(id);
    // Optimistic remove
    setMessages((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
    try {
      await api.forum.remove(id);
      toast.success("Message removed.");
    } catch (e: any) {
      // Restore on error
      setMessages((prev) => (prev ? [...prev, target].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [target]));
      toast.error(e?.message || "Failed to remove message");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <MobileHeader title="Assembly Forum" subtitle="Assembly-wide message board" />
      <DesktopTopBar title="Assembly Forum" subtitle="All members can post; admins moderate" />

      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl animate-fade-in">
        {error && (
          <CACICard className="mb-4 border-caci-red/30 bg-caci-red-bg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-caci-red shrink-0 mt-0.5" />
              <p className="text-[14px] text-caci-red">{error}</p>
            </div>
          </CACICard>
        )}

        {/* Compose */}
        <CACICard padding="default" className="mb-4">
          <CACITextarea
            label="Share with the assembly"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message for the assembly…"
            className="min-h-[80px]"
            disabled={posting}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-n400">
              {draft.length > 0 ? `${draft.length} character${draft.length === 1 ? "" : "s"}` : "All members will see this post"}
            </p>
            <CACIButton
              size="sm"
              onClick={handlePost}
              loading={posting}
              disabled={!draft.trim()}
              leftIcon={!posting ? <Send size={14} /> : undefined}
            >
              {posting ? "Posting…" : "Post"}
            </CACIButton>
          </div>
        </CACICard>

        {/* Messages */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <CACISkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((m) => (
              <ForumMessage
                key={m.id}
                message={m}
                canDelete={user?.role === "admin"}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
            <div ref={listEndRef} />
          </div>
        ) : (
          <EmptyState
            icon={<MessageSquare size={20} />}
            title="No messages yet"
            description="Be the first to share an announcement, prayer request, or encouragement with the assembly."
          />
        )}
      </div>
    </>
  );
}

function ForumMessage({
  message,
  canDelete,
  onDelete,
}: {
  message: ForumMessageDTO;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const own = !!message.isOwn;
  return (
    <CACICard
      padding="default"
      className={cn(
        "animate-fade-in relative",
        own && "border-l-4 border-l-caci-red",
      )}
    >
      <div className="flex items-start gap-3">
        <CaciAvatar name={message.memberName} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-n900 truncate">{message.memberName}</p>
            {message.memberTitle && (
              <span className="text-[11px] text-n400">{message.memberTitle}</span>
            )}
            {message.memberRole && (
              <RoleBadge role={message.memberRole.toLowerCase().includes("admin") || message.memberRole.toLowerCase().includes("pastor") ? "admin" : "member"} />
            )}
            {own && (
              <span className="text-[10px] uppercase tracking-wide text-caci-red font-medium">You</span>
            )}
          </div>
          <p className="text-[14px] text-n700 mt-1 whitespace-pre-wrap break-words">{message.content}</p>
          <p className="text-[11px] text-n400 mt-2">{formatRelative(message.createdAt)}</p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="size-8 flex items-center justify-center rounded-md text-n300 hover:text-caci-red hover:bg-caci-red-bg transition-colors shrink-0"
            aria-label="Delete message"
            title="Delete message"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </CACICard>
  );
}
