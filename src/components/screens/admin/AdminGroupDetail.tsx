"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  UsersRound, Crown, Lock, Unlock, Archive, Send, Calendar, MessageSquare, Trash2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { GroupDTO, GroupMessageDTO, MemberDTO } from "@/lib/types";
import { formatDate, formatRelative, chatDayLabel } from "@/lib/format";
import {
  CACIButton, CACICard, CaciAvatar, CACISkeleton, EmptyState, SectionHeading, CACITextarea,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GroupDetailData extends GroupDTO {
  members: Array<{
    id: string; fullName: string; title: string | null;
    assemblyRole: string | null; membershipStatus: string;
    phoneNumber: string | null; joinedAt: string; isLeader: boolean;
  }>;
  messages: GroupMessageDTO[];
}

export function AdminGroupDetail() {
  const { params, navigate, back, setParam, user } = useApp();
  const groupId = params.groupId;
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [postingAsAdmin, setPostingAsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await api.groups.get(groupId);
      setGroup(res.group as GroupDetailData);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load group");
      back();
    } finally {
      setLoading(false);
    }
  }, [groupId, back]);

  useEffect(() => {
    setLoading(true);
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [group?.messages.length]);

  const handleArchive = async () => {
    if (!group) return;
    setArchiving(true);
    try {
      await api.groups.archive(group.id);
      toast.success("Group archived");
      back();
    } catch (e: any) {
      toast.error(e?.message || "Failed to archive");
    } finally {
      setArchiving(false);
    }
  };

  const handleSend = async () => {
    if (!group || !message.trim()) return;
    const content = message.trim();
    setMessage("");
    setSending(true);
    // Optimistic: append a temp message
    const tempMsg: GroupMessageDTO = {
      id: `temp-${Date.now()}`,
      groupId: group.id,
      memberId: user!.id,
      memberName: user!.fullName,
      memberTitle: "Admin",
      content,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setGroup((g) => g ? { ...g, messages: [...g.messages, tempMsg] } : g);
    try {
      // Admin posts as themselves; the API requires a member profile.
      // If admin has no memberId, we cannot post via group-messages endpoint.
      if (!user?.memberId) {
        setPostingAsAdmin(true);
        // fall back to optimistic display only — show a toast
        toast.info("Admin posts are view-only in this demo. Link an admin member profile to enable chat posting.");
      } else {
        const res = await api.groupMessages.post(group.id, content);
        setGroup((g) => g ? {
          ...g,
          messages: [...(g.messages.filter((m) => m.id !== tempMsg.id)), res.message],
        } : g);
      }
    } catch (e: any) {
      // revert
      setGroup((g) => g ? { ...g, messages: g.messages.filter((m) => m.id !== tempMsg.id) } : g);
      setMessage(content);
      toast.error(e?.message || "Failed to send message");
    } finally {
      setSending(false);
      setPostingAsAdmin(false);
    }
  };

  const goToMember = (id: string) => {
    setParam("memberId", id);
    navigate("admin-member-detail");
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="Group" onBack={back} />
        <DesktopTopBar title="Group" />
        <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-4xl space-y-4">
          <CACISkeleton className="h-32 rounded-lg" />
          <CACISkeleton className="h-48 rounded-lg" />
        </div>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <MobileHeader title="Group" onBack={back} />
        <DesktopTopBar title="Group" />
        <EmptyState title="Group not found" action={<CACIButton onClick={back}>Go back</CACIButton>} />
      </>
    );
  }

  return (
    <>
      <MobileHeader
        title={group.name}
        subtitle={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`}
        onBack={back}
      />
      <DesktopTopBar
        title={group.name}
        subtitle={`${group.memberCount} members · ${group.messagingMode === "open" ? "Open messaging" : "Restricted messaging"}`}
        action={
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <CACIButton variant="ghost" size="sm">Manage</CACIButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("admin-group-add")} className="text-n500">
                  Edit group (use New Group form)
                </DropdownMenuItem>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-caci-red focus:text-caci-red">
                    <Archive size={14} className="mr-2" /> Archive group
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {group.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Archived groups are hidden from members. You can restore them from the &quot;Archived&quot; filter. Group history is preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleArchive}
                  disabled={archiving}
                  className="bg-caci-red text-white hover:bg-caci-red-light"
                >
                  {archiving ? "Archiving…" : "Archive Group"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-4xl space-y-4">
        {/* Header card */}
        <CACICard padding="lg">
          <div className="flex items-start gap-3">
            <div className={cn(
              "size-14 rounded-xl flex items-center justify-center shrink-0",
              group.isActive ? "bg-caci-blue-bg text-caci-blue" : "bg-n50 text-n400",
            )}>
              <UsersRound size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[20px] font-bold text-n900">{group.name}</h2>
                {!group.isActive && (
                  <span className="text-[11px] bg-n100 text-n500 px-2 py-0.5 rounded-md font-medium">Archived</span>
                )}
                {group.messagingMode === "restricted" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-[#fff8c5] text-[#9a6700] px-2 py-0.5 rounded-md font-medium">
                    <Lock size={11} /> Restricted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-caci-blue-bg text-caci-blue px-2 py-0.5 rounded-md font-medium">
                    <Unlock size={11} /> Open
                  </span>
                )}
              </div>
              {group.description && <p className="text-[14px] text-n500 mt-1">{group.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[12px] text-n400">
                {group.leaderName && (
                  <span className="flex items-center gap-1">
                    <Crown size={12} className="text-caci-red" /> {group.leaderName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Created {formatDate(group.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </CACICard>

        {/* Members */}
        <CACICard>
          <SectionHeading
            title={`Members (${group.members.length})`}
            className="mb-3"
          />
          {group.members.length === 0 ? (
            <p className="text-[14px] text-n400 py-2">No members in this group yet.</p>
          ) : (
            <div className="space-y-1">
              {group.members
                .slice()
                .sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0))
                .map((m) => (
                <button
                  key={m.id}
                  onClick={() => goToMember(m.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-n50 text-left transition-colors"
                >
                  <CaciAvatar name={m.fullName} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-n900 truncate">
                      {m.title ? `${m.title} ` : ""}{m.fullName}
                    </p>
                    <p className="text-[12px] text-n400 truncate">
                      {m.assemblyRole || m.membershipStatus}
                    </p>
                  </div>
                  {m.isLeader && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-caci-red-bg text-caci-red px-2 py-0.5 rounded-full font-medium">
                      <Crown size={11} /> Leader
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CACICard>

        {/* Group chat */}
        <CACICard padding="none">
          <div className="p-4 border-b border-n100">
            <SectionHeading title="Group Chat" />
          </div>
          <div className="max-h-96 overflow-y-auto scroll-caci p-4 space-y-3">
            {group.messages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare size={22} />}
                title="No messages yet"
                description="Start the conversation in this group."
              />
            ) : (
              group.messages.map((m, idx) => {
                const prev = group.messages[idx - 1];
                const showDay = !prev || chatDayLabel(prev.createdAt) !== chatDayLabel(m.createdAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex items-center justify-center my-2">
                        <span className="text-[11px] text-n400 bg-n50 px-2 py-0.5 rounded-full">
                          {chatDayLabel(m.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex gap-2", m.isOwn ? "flex-row-reverse" : "")}>
                      {!m.isOwn && <CaciAvatar name={m.memberName} size={32} className="mt-1 shrink-0" />}
                      <div className={cn("max-w-[75%]", m.isOwn ? "items-end" : "")}>
                        {!m.isOwn && (
                          <p className="text-[12px] font-medium text-n700 mb-0.5 ml-1">
                            {m.memberTitle ? `${m.memberTitle} ` : ""}{m.memberName}
                          </p>
                        )}
                        <div className={cn(
                          "rounded-2xl px-3 py-2 text-[14px] break-words",
                          m.isOwn
                            ? "bg-caci-red text-white rounded-tr-sm"
                            : "bg-n50 text-n900 rounded-tl-sm",
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          {group.isActive && (
            <div className="border-t border-n100 p-3 flex gap-2 items-end">
              <CACITextarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={postingAsAdmin ? "View-only (no member profile linked)" : "Type a message…"}
                className="min-h-[44px] max-h-32 resize-none flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <CACIButton
                size="icon"
                onClick={handleSend}
                disabled={!message.trim() || sending || !user?.memberId}
              >
                <Send size={18} />
              </CACIButton>
            </div>
          )}
        </CACICard>
      </div>
    </>
  );
}
