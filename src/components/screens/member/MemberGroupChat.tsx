"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Lock, Crown, Users, MessageSquare } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { GroupDTO, GroupMessageDTO } from "@/lib/types";
import { formatRelative, chatDayLabel } from "@/lib/format";
import {
  CACIButton, CACICard, CaciAvatar, CACISkeleton, EmptyState, CACITextarea,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MemberGroupChat() {
  const { params, back, user } = useApp();
  const groupId = params.groupId;
  const [group, setGroup] = useState<(GroupDTO & { members: any[]; messages: GroupMessageDTO[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await api.groups.get(groupId);
      setGroup(res.group);
    } catch (e: any) {
      setError(e?.message || "Failed to load group");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [group?.messages.length]);

  const canPost = (() => {
    if (!group || !user?.memberId) return false;
    if (group.messagingMode === "open") return true;
    // restricted: leader or admin
    return group.leaderId === user.memberId || user.role === "admin";
  })();

  const handleSend = async () => {
    if (!group || !message.trim()) return;
    const content = message.trim();
    setMessage("");
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: GroupMessageDTO = {
      id: tempId,
      groupId: group.id,
      memberId: user!.id,
      memberName: user!.fullName,
      memberTitle: null,
      content,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setGroup((g) => g ? { ...g, messages: [...g.messages, tempMsg] } : g);
    try {
      const res = await api.groupMessages.post(group.id, content);
      setGroup((g) => g ? {
        ...g,
        messages: [...(g.messages.filter((m) => m.id !== tempId)), res.message],
      } : g);
    } catch (e: any) {
      setGroup((g) => g ? { ...g, messages: g.messages.filter((m) => m.id !== tempId) } : g);
      setMessage(content);
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="Group Chat" onBack={back} />
        <DesktopTopBar title="Group Chat" />
        <div className="px-4 py-4 max-w-md mx-auto md:max-w-3xl">
          <CACISkeleton className="h-32 rounded-lg" />
        </div>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <MobileHeader title="Group Chat" onBack={back} />
        <DesktopTopBar title="Group Chat" />
        <EmptyState title="Group not found" action={<CACIButton onClick={back}>Go back</CACIButton>} />
      </>
    );
  }

  const isLeader = group.leaderId === user?.memberId;

  return (
    <>
      <MobileHeader
        title={group.name}
        subtitle={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`}
        onBack={back}
      />
      <DesktopTopBar
        title={group.name}
        subtitle={`${group.memberCount} members · ${group.messagingMode === "open" ? "Open chat" : "Restricted (leader only)"}`}
        onBack={back}
      />
      <div className="px-0 py-0 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl flex flex-col">
        {/* Restricted banner */}
        {group.messagingMode === "restricted" && !canPost && (
          <div className="mx-4 md:mx-0 mt-4 bg-[#fff8c5] border border-[#9a6700]/20 rounded-lg p-3 flex items-start gap-2">
            <Lock size={16} className="text-[#9a6700] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#9a6700]">
              This group is restricted. Only the group leader can post messages.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-[50vh] md:min-h-[60vh] overflow-y-auto scroll-caci px-4 py-4 md:px-6">
          {group.messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={26} />}
              title="No messages yet"
              description={canPost ? "Be the first to say hello!" : "Check back later for messages from the group leader."}
            />
          ) : (
            <div className="space-y-3">
              {group.messages.map((m, idx) => {
                const prev = group.messages[idx - 1];
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
                    <div className={cn("flex gap-2", m.isOwn ? "flex-row-reverse" : "")}>
                      {!m.isOwn && <CaciAvatar name={m.memberName} size={32} className="mt-1 shrink-0" />}
                      <div className={cn("max-w-[75%]", m.isOwn ? "items-end flex flex-col" : "")}>
                        {!m.isOwn && (
                          <p className="text-[12px] font-medium text-n700 mb-0.5 ml-1 flex items-center gap-1">
                            {m.memberTitle ? `${m.memberTitle} ` : ""}{m.memberName}
                            {group.leaderId === m.memberId && (
                              <Crown size={10} className="text-caci-red" />
                            )}
                          </p>
                        )}
                        <div className={cn(
                          "rounded-2xl px-3 py-2 text-[14px] break-words",
                          m.isOwn
                            ? "bg-caci-red text-white rounded-tr-sm"
                            : "bg-white border border-n100 text-n900 rounded-tl-sm",
                        )}>
                          {m.content}
                        </div>
                        <p className={cn("text-[11px] text-n400 mt-0.5", m.isOwn ? "text-right mr-1" : "ml-1")}>
                          {formatRelative(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        {canPost && (
          <div className="border-t border-n100 bg-white p-3 md:px-6 md:py-4 flex items-center gap-3 shrink-0 shadow-xs">
            <div className="flex-1 flex items-center gap-2 bg-n50 hover:bg-n100/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-caci-blue/20 focus-within:border-caci-blue border border-n200/80 rounded-2xl px-4 py-2.5 transition-all">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Message ${group.name}…`}
                rows={1}
                className="w-full bg-transparent border-0 outline-none text-[14px] text-n900 placeholder:text-n400 resize-none max-h-28 py-0.5 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="size-11 rounded-2xl bg-caci-blue hover:bg-[#1e40af] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 disabled:hover:bg-caci-blue disabled:active:scale-100 transition-all cursor-pointer"
              aria-label="Send message"
            >
              <Send size={18} className="translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
