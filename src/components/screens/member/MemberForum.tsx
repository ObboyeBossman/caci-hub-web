"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Trash2, MessageSquare, Users } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { ForumMessageDTO } from "@/lib/types";
import { formatRelative, chatDayLabel } from "@/lib/format";
import {
  CACIButton, CACICard, CaciAvatar, CACISkeleton, EmptyState, CACITextarea,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MemberForum() {
  const { user, back } = useApp();
  const [messages, setMessages] = useState<ForumMessageDTO[] | null>(null);
  const [assemblyName, setAssemblyName] = useState<string>("Assakae Central Assembly");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [res, settingsRes] = await Promise.allSettled([
        api.forum.list(),
        api.settings.get(),
      ]);
      if (res.status === "fulfilled") setMessages(res.value.messages);
      else setMessages([]);

      if (settingsRes.status === "fulfilled" && settingsRes.value.settings?.assemblyName) {
        setAssemblyName(settingsRes.value.settings.assemblyName);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handlePost = async () => {
    if (!content.trim()) return;
    const text = content.trim();
    setContent("");
    setSending(true);
    // optimistic
    const tempId = `temp-${Date.now()}`;
    const temp: ForumMessageDTO = {
      id: tempId,
      memberId: user!.id,
      memberName: user!.fullName,
      memberTitle: null,
      memberRole: null,
      content: text,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((m) => [...(m || []), temp]);
    try {
      const res = await api.forum.post(text);
      setMessages((m) => [...(m || []).filter((x) => x.id !== tempId), res.message]);
    } catch (e: any) {
      setMessages((m) => (m || []).filter((x) => x.id !== tempId));
      setContent(text);
      toast.error(e?.message || "Failed to post");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = messages;
    setMessages((m) => (m || []).filter((x) => x.id !== id));
    try {
      await api.forum.remove(id);
      toast.success("Message removed");
    } catch (e: any) {
      setMessages(prev);
      toast.error(e?.message || "Failed to delete");
    }
  };

  return (
    <>
      <MobileHeader title={assemblyName} subtitle="Assembly Forum" onBack={back} />
      <DesktopTopBar title={assemblyName} subtitle="Assembly Forum — Share encouragement, prayer requests, and updates with the assembly" onBack={back} />
      <div className="px-0 py-0 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl flex flex-col">
        <div className="flex-1 min-h-[50vh] overflow-y-auto scroll-caci px-4 py-4 md:px-6">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <CACICard key={i} className="flex items-start gap-3">
                  <CACISkeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <CACISkeleton className="h-3 w-1/3" />
                    <CACISkeleton className="h-4 w-full" />
                  </div>
                </CACICard>
              ))}
            </div>
          )}

          {!loading && (messages || []).length === 0 && (
            <EmptyState
              icon={<MessageSquare size={26} />}
              title="No messages yet"
              description="Be the first to share an encouragement or prayer request with the assembly."
            />
          )}

          {!loading && (messages || []).length > 0 && (
            <div className="space-y-3">
              {(messages || []).map((m, idx) => {
                const prev = (messages || [])[idx - 1];
                const showDay = !prev || chatDayLabel(prev.createdAt) !== chatDayLabel(m.createdAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex items-center justify-center my-3">
                        <span className="text-[11px] text-n400 bg-n50 px-2 py-0.5 rounded-full">
                          {chatDayLabel(m.createdAt)}
                        </span>
                      </div>
                    )}
                    <CACICard className={cn("flex items-start gap-3", m.isOwn && "border-l-4 border-l-caci-red")}>
                      <CaciAvatar name={m.memberName} size={36} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-semibold text-n900">
                            {m.memberTitle ? `${m.memberTitle} ` : ""}{m.memberName}
                          </p>
                          {m.memberRole && (
                            <span className="text-[11px] bg-caci-blue-bg text-caci-blue px-1.5 py-0.5 rounded font-medium">
                              {m.memberRole}
                            </span>
                          )}
                          <span className="text-[12px] text-n400">· {formatRelative(m.createdAt)}</span>
                        </div>
                        <p className="text-[14px] text-n700 mt-1 whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      {user?.role === "admin" && !m.isOwn && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="size-7 flex items-center justify-center rounded-md text-n400 hover:text-caci-red hover:bg-caci-red-bg shrink-0" aria-label="Delete message">
                              <Trash2 size={14} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this message?</AlertDialogTitle>
                              <AlertDialogDescription>
                                The message from {m.memberName} will be permanently removed from the forum.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(m.id)} className="bg-caci-red text-white hover:bg-caci-red-light">
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </CACICard>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-n100 bg-white p-3 md:px-6 md:py-4 flex items-center gap-3 shrink-0 shadow-xs">
          <div className="flex-1 flex items-center gap-2 bg-n50 hover:bg-n100/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-caci-blue/20 focus-within:border-caci-blue border border-n200/80 rounded-2xl px-4 py-2.5 transition-all">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share a message with the assembly…"
              rows={1}
              className="w-full bg-transparent border-0 outline-none text-[14px] text-n900 placeholder:text-n400 resize-none max-h-28 py-0.5 leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
            />
          </div>
          <button
            onClick={handlePost}
            disabled={!content.trim() || sending}
            className="size-11 rounded-2xl bg-caci-blue hover:bg-[#1e40af] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 disabled:hover:bg-caci-blue disabled:active:scale-100 transition-all cursor-pointer"
            aria-label="Send message"
          >
            <Send size={18} className="translate-x-0.5" />
          </button>
        </div>
      </div>
    </>
  );
}
