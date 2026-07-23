"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  UsersRound,
  Crown,
  Lock,
  Unlock,
  Search,
  Building2,
  Send,
  Trash2,
  Radio,
  ChevronLeft,
  Filter,
  Sparkles,
  Shield,
  Clock,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { GroupDTO, ForumMessageDTO, GroupMessageDTO } from "@/lib/types";
import { formatRelative, chatDayLabel } from "@/lib/format";
import {
  CACICard,
  CACISkeleton,
  EmptyState,
  CaciAvatar,
  CACITextarea,
  CACIButton,
} from "@/components/caci/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SelectedChat =
  | { type: "forum" }
  | { type: "group"; groupId: string };

export function MemberGroups() {
  const { user, params, setParam, screen } = useApp();

  // Layout & Navigation State
  const [selectedChat, setSelectedChat] = useState<SelectedChat>(() => {
    if (screen === "member-forum") return { type: "forum" };
    if (params.groupId) return { type: "group", groupId: params.groupId };
    return { type: "forum" };
  });

  const [mobileView, setMobileView] = useState<"list" | "chat">(() => {
    if (screen === "member-forum" || screen === "member-group-chat") return "chat";
    return "list";
  });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "forum" | "groups">("all");

  // Data States
  const [assemblyName, setAssemblyName] = useState<string>("Assakae Central Assembly");
  const [groups, setGroups] = useState<GroupDTO[] | null>(null);
  const [forumMessages, setForumMessages] = useState<ForumMessageDTO[] | null>(null);
  const [groupDetails, setGroupDetails] = useState<
    Record<string, { group: GroupDTO; messages: GroupMessageDTO[] }>
  >({});

  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync selected chat if params change externally
  useEffect(() => {
    if (screen === "member-forum") {
      setSelectedChat({ type: "forum" });
      setMobileView("chat");
    } else if (params.groupId) {
      setSelectedChat({ type: "group", groupId: params.groupId });
      setMobileView("chat");
    }
  }, [params.groupId, screen]);

  // Load initial channel list data
  const loadInitialData = useCallback(async () => {
    setLoadingList(true);
    try {
      const [groupsRes, settingsRes, forumRes] = await Promise.allSettled([
        api.groups.list({ memberId: user?.memberId }),
        api.settings.get(),
        api.forum.list(),
      ]);

      if (groupsRes.status === "fulfilled") {
        setGroups(groupsRes.value.groups);
      } else {
        setGroups([]);
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.settings?.assemblyName) {
        setAssemblyName(settingsRes.value.settings.assemblyName);
      }

      if (forumRes.status === "fulfilled") {
        setForumMessages(forumRes.value.messages);
      } else {
        setForumMessages([]);
      }
    } catch {
      setGroups([]);
      setForumMessages([]);
    } finally {
      setLoadingList(false);
    }
  }, [user?.memberId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load selected group details when active chat is a group
  const loadActiveGroup = useCallback(async (groupId: string) => {
    setLoadingChat(true);
    try {
      const res = await api.groups.get(groupId);
      setGroupDetails((prev) => ({
        ...prev,
        [groupId]: {
          group: res.group,
          messages: res.group.messages || [],
        },
      }));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load group chat");
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChat.type === "group") {
      loadActiveGroup(selectedChat.groupId);
    }
  }, [selectedChat, loadActiveGroup]);

  // Scroll to bottom of message thread on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    selectedChat.type === "forum"
      ? forumMessages?.length
      : selectedChat.type === "group"
      ? groupDetails[selectedChat.groupId]?.messages.length
      : 0,
  ]);

  // Select a conversation item
  const handleSelectForum = () => {
    setSelectedChat({ type: "forum" });
    setMobileView("chat");
    setParam("groupId", undefined);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedChat({ type: "group", groupId });
    setParam("groupId", groupId);
    setMobileView("chat");
  };

  // Post message handler
  const handleSendMessage = async () => {
    if (!content.trim() || sending) return;
    const text = content.trim();
    setContent("");
    setSending(true);

    if (selectedChat.type === "forum") {
      const tempId = `temp-forum-${Date.now()}`;
      const tempMsg: ForumMessageDTO = {
        id: tempId,
        memberId: user!.id,
        memberName: user!.fullName,
        memberTitle: null,
        memberRole: user?.role === "admin" ? "Administrator" : null,
        content: text,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };

      setForumMessages((prev) => [...(prev || []), tempMsg]);

      try {
        const res = await api.forum.post(text);
        setForumMessages((prev) => [
          ...(prev || []).filter((m) => m.id !== tempId),
          res.message,
        ]);
      } catch (e: any) {
        setForumMessages((prev) => (prev || []).filter((m) => m.id !== tempId));
        setContent(text);
        toast.error(e?.message || "Failed to post message");
      } finally {
        setSending(false);
      }
    } else {
      const gId = selectedChat.groupId;
      const tempId = `temp-group-${Date.now()}`;
      const tempMsg: GroupMessageDTO = {
        id: tempId,
        groupId: gId,
        memberId: user!.id,
        memberName: user!.fullName,
        memberTitle: null,
        content: text,
        createdAt: new Date().toISOString(),
        isOwn: true,
      };

      setGroupDetails((prev) => {
        const current = prev[gId];
        if (!current) return prev;
        return {
          ...prev,
          [gId]: {
            ...current,
            messages: [...current.messages, tempMsg],
          },
        };
      });

      try {
        const res = await api.groupMessages.post(gId, text);
        setGroupDetails((prev) => {
          const current = prev[gId];
          if (!current) return prev;
          return {
            ...prev,
            [gId]: {
              ...current,
              messages: [...current.messages.filter((m) => m.id !== tempId), res.message],
            },
          };
        });
      } catch (e: any) {
        setGroupDetails((prev) => {
          const current = prev[gId];
          if (!current) return prev;
          return {
            ...prev,
            [gId]: {
              ...current,
              messages: current.messages.filter((m) => m.id !== tempId),
            },
          };
        });
        setContent(text);
        toast.error(e?.message || "Failed to send message");
      } finally {
        setSending(false);
      }
    }
  };

  // Forum delete handler (admin)
  const handleDeleteForumMessage = async (id: string) => {
    const prev = forumMessages;
    setForumMessages((m) => (m || []).filter((x) => x.id !== id));
    try {
      await api.forum.remove(id);
      toast.success("Message removed");
    } catch (e: any) {
      setForumMessages(prev);
      toast.error(e?.message || "Failed to delete message");
    }
  };

  // Filter groups
  const filteredGroups = (groups || []).filter((g) => {
    if (filterTab === "forum") return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q));
  });

  const showForumInList =
    filterTab !== "groups" &&
    (!searchQuery.trim() ||
      assemblyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      "assembly forum".includes(searchQuery.toLowerCase()));

  const latestForumMsg = forumMessages && forumMessages.length > 0 ? forumMessages[forumMessages.length - 1] : null;

  // Active chat state properties
  const currentGroupData = selectedChat.type === "group" ? groupDetails[selectedChat.groupId] : null;
  const currentGroup = currentGroupData?.group;

  const canPostInGroup = (() => {
    if (selectedChat.type === "forum") return true;
    if (!currentGroup || !user?.memberId) return false;
    if (currentGroup.messagingMode === "open") return true;
    return currentGroup.leaderId === user.memberId || user.role === "admin";
  })();

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* ============================================================ */}
      {/* MIDDLE COLUMN: Conversations & Channels Panel                 */}
      {/* ============================================================ */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 border-r border-n100 flex flex-col shrink-0 bg-white z-10 transition-all duration-200 h-full",
          mobileView === "chat" ? "hidden md:flex" : "flex"
        )}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-n100 space-y-3 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold text-n900 flex items-center gap-2">
              <MessageSquare className="text-caci-blue" size={22} />
              Chats
            </h2>
            <span className="text-[12px] font-semibold text-n500 bg-n100 px-2 py-0.5 rounded-full">
              {(groups?.length || 0) + 1}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-n400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-n50 border border-n100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-n900 placeholder:text-n400 focus:outline-none focus:ring-2 focus:ring-caci-blue/20 focus:border-caci-blue transition-all"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setFilterTab("all")}
              className={cn(
                "px-3 py-1 rounded-lg text-[12px] font-medium transition-all select-none",
                filterTab === "all"
                  ? "bg-caci-blue text-white shadow-xs"
                  : "bg-n50 text-n600 hover:bg-n100"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab("forum")}
              className={cn(
                "px-3 py-1 rounded-lg text-[12px] font-medium transition-all select-none",
                filterTab === "forum"
                  ? "bg-caci-blue text-white shadow-xs"
                  : "bg-n50 text-n600 hover:bg-n100"
              )}
            >
              Assembly
            </button>
            <button
              onClick={() => setFilterTab("groups")}
              className={cn(
                "px-3 py-1 rounded-lg text-[12px] font-medium transition-all select-none",
                filterTab === "groups"
                  ? "bg-caci-blue text-white shadow-xs"
                  : "bg-n50 text-n600 hover:bg-n100"
              )}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Channels & Group List */}
        <div className="flex-1 overflow-y-auto scroll-caci p-2 space-y-1.5">
          {loadingList ? (
            <div className="p-3 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <CACISkeleton className="size-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <CACISkeleton className="h-4 w-2/3" />
                    <CACISkeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Pinned Assembly Forum Channel */}
              {showForumInList && (
                <button
                  onClick={handleSelectForum}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all duration-150 flex items-start gap-3 relative group select-none",
                    selectedChat.type === "forum"
                      ? "bg-caci-blue-bg/90 border border-caci-blue/20 text-caci-blue shadow-xs font-medium"
                      : "hover:bg-n50 text-n800"
                  )}
                >
                  <div
                    className={cn(
                      "size-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors",
                      selectedChat.type === "forum"
                        ? "bg-caci-blue text-white"
                        : "bg-caci-blue-bg text-caci-blue group-hover:bg-caci-blue group-hover:text-white"
                    )}
                  >
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-[14px] truncate leading-snug">
                        {assemblyName}
                      </p>
                      {latestForumMsg && (
                        <span className="text-[11px] text-n400 shrink-0">
                          {formatRelative(latestForumMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] uppercase font-extrabold bg-caci-blue/15 text-caci-blue px-1.5 py-0.2 rounded shrink-0">
                        Forum
                      </span>
                      <p className="text-[12px] text-n500 truncate">
                        {latestForumMsg ? `${latestForumMsg.memberName}: ${latestForumMsg.content}` : "Official assembly forum"}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Groups List */}
              {filteredGroups.map((g) => {
                const isSelected = selectedChat.type === "group" && selectedChat.groupId === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleSelectGroup(g.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all duration-150 flex items-start gap-3 relative group select-none",
                      isSelected
                        ? "bg-caci-blue-bg/90 border border-caci-blue/20 text-caci-blue shadow-xs font-medium"
                        : "hover:bg-n50 text-n800"
                    )}
                  >
                    <div
                      className={cn(
                        "size-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors",
                        isSelected
                          ? "bg-caci-blue text-white"
                          : "bg-n100 text-n600 group-hover:bg-caci-blue-bg group-hover:text-caci-blue"
                      )}
                    >
                      <UsersRound size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-[14px] truncate leading-snug">{g.name}</p>
                          {g.leaderId === user?.memberId && (
                            <span className="text-[10px] bg-caci-red-bg text-caci-red px-1.5 py-0.2 rounded font-bold shrink-0">
                              Leader
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] text-n500 truncate mt-0.5">
                        {g.description || `${g.memberCount} members`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-n400">{g.memberCount} members</span>
                        <span className="text-n300">•</span>
                        {g.messagingMode === "restricted" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#9a6700] font-medium">
                            <Lock size={9} /> Restricted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-caci-blue font-medium">
                            <Unlock size={9} /> Open
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!showForumInList && filteredGroups.length === 0 && (
                <div className="p-6 text-center text-n400 text-xs">
                  No conversations match your search.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Active Conversation Window                      */}
      {/* ============================================================ */}
      <div
        className={cn(
          "flex-1 flex flex-col bg-slate-50 h-full min-w-0 relative",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}
      >
        {/* Chat Window Header */}
        <div className="h-16 px-4 md:px-6 bg-white border-b border-n100 flex items-center justify-between shrink-0 shadow-2xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Back Button */}
            <button
              onClick={() => setMobileView("list")}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-n600 hover:bg-n100"
              aria-label="Back to conversations list"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              className={cn(
                "size-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs",
                selectedChat.type === "forum" ? "bg-caci-blue" : "bg-n800"
              )}
            >
              {selectedChat.type === "forum" ? <Building2 size={20} /> : <UsersRound size={20} />}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-[16px] text-n900 truncate leading-tight flex items-center gap-2">
                {selectedChat.type === "forum" ? assemblyName : currentGroup?.name || "Group Chat"}
                {selectedChat.type === "forum" ? (
                  <span className="text-[10px] uppercase font-bold bg-caci-blue-bg text-caci-blue px-2 py-0.5 rounded-full">
                    Assembly Forum
                  </span>
                ) : (
                  currentGroup?.messagingMode === "restricted" && (
                    <span className="text-[10px] uppercase font-bold bg-[#fff8c5] text-[#9a6700] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock size={9} /> Restricted
                    </span>
                  )
                )}
              </h1>
              <p className="text-[12px] text-n400 truncate leading-tight mt-0.5">
                {selectedChat.type === "forum"
                  ? "General Community Board · Official Channel"
                  : `${currentGroup?.memberCount || 0} members · ${
                      currentGroup?.messagingMode === "open" ? "Open Chat" : "Leader Broadcast"
                    }`}
              </p>
            </div>
          </div>
        </div>

        {/* Message Thread Body */}
        <div className="flex-1 overflow-y-auto scroll-caci px-4 py-4 md:px-8 space-y-4">
          {loadingChat && selectedChat.type === "group" ? (
            <div className="space-y-4 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 items-start">
                  <CACISkeleton className="size-9 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <CACISkeleton className="h-3 w-1/4" />
                    <CACISkeleton className="h-10 w-2/3 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Render Forum Messages */}
          {selectedChat.type === "forum" && (
            <>
              {forumMessages && forumMessages.length === 0 && (
                <EmptyState
                  icon={<MessageSquare size={26} />}
                  title="No forum messages yet"
                  description="Be the first to share an encouragement or update with the assembly."
                />
              )}

              {(forumMessages || []).map((m, idx) => {
                const prev = (forumMessages || [])[idx - 1];
                const showDay = !prev || chatDayLabel(prev.createdAt) !== chatDayLabel(m.createdAt);

                return (
                  <div key={m.id} className="space-y-3">
                    {showDay && (
                      <div className="flex items-center justify-center my-4">
                        <span className="text-[11px] font-semibold text-n400 bg-white border border-n100 shadow-2xs px-3 py-1 rounded-full">
                          {chatDayLabel(m.createdAt)}
                        </span>
                      </div>
                    )}

                    <div className={cn("flex items-start gap-3 group", m.isOwn ? "flex-row-reverse" : "")}>
                      {!m.isOwn && <CaciAvatar name={m.memberName} size={34} className="mt-1 shrink-0" />}
                      <div className={cn("max-w-[80%] md:max-w-[70%]", m.isOwn ? "items-end flex flex-col" : "")}>
                        {!m.isOwn && (
                          <div className="flex items-center gap-1.5 mb-1 ml-1">
                            <span className="text-[12px] font-bold text-n800">
                              {m.memberTitle ? `${m.memberTitle} ` : ""}
                              {m.memberName}
                            </span>
                            {m.memberRole && (
                              <span className="text-[10px] bg-caci-blue-bg text-caci-blue px-1.5 py-0.2 rounded font-semibold">
                                {m.memberRole}
                              </span>
                            )}
                          </div>
                        )}

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words shadow-2xs",
                            m.isOwn
                              ? "bg-caci-blue text-white rounded-tr-xs"
                              : "bg-white border border-n100/90 text-n900 rounded-tl-xs"
                          )}
                        >
                          {m.content}
                        </div>

                        <div className={cn("flex items-center gap-2 mt-1", m.isOwn ? "justify-end mr-1" : "ml-1")}>
                          <span className="text-[11px] text-n400">{formatRelative(m.createdAt)}</span>

                          {/* Admin Delete Action */}
                          {user?.role === "admin" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 text-n400 hover:text-caci-red transition-opacity p-0.5">
                                  <Trash2 size={12} />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove this message?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    The message from {m.memberName} will be deleted permanently.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteForumMessage(m.id)}
                                    className="bg-caci-red text-white"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Render Group Messages */}
          {selectedChat.type === "group" && currentGroupData && (
            <>
              {currentGroupData.messages.length === 0 && (
                <EmptyState
                  icon={<MessageSquare size={26} />}
                  title="No messages yet"
                  description={
                    canPostInGroup
                      ? `Be the first to post a message in ${currentGroup?.name || "this group"}!`
                      : "Check back later for broadcast updates from the group leader."
                  }
                />
              )}

              {currentGroupData.messages.map((m, idx) => {
                const prev = currentGroupData.messages[idx - 1];
                const showDay = !prev || chatDayLabel(prev.createdAt) !== chatDayLabel(m.createdAt);

                return (
                  <div key={m.id} className="space-y-3">
                    {showDay && (
                      <div className="flex items-center justify-center my-4">
                        <span className="text-[11px] font-semibold text-n400 bg-white border border-n100 shadow-2xs px-3 py-1 rounded-full">
                          {chatDayLabel(m.createdAt)}
                        </span>
                      </div>
                    )}

                    <div className={cn("flex gap-2.5", m.isOwn ? "flex-row-reverse" : "")}>
                      {!m.isOwn && <CaciAvatar name={m.memberName} size={32} className="mt-1 shrink-0" />}
                      <div className={cn("max-w-[80%] md:max-w-[70%]", m.isOwn ? "items-end flex flex-col" : "")}>
                        {!m.isOwn && (
                          <p className="text-[12px] font-bold text-n800 mb-1 ml-1 flex items-center gap-1">
                            {m.memberTitle ? `${m.memberTitle} ` : ""}
                            {m.memberName}
                            {currentGroup?.leaderId === m.memberId && (
                              <Crown size={11} className="text-caci-red" />
                            )}
                          </p>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words shadow-2xs",
                            m.isOwn
                              ? "bg-caci-blue text-white rounded-tr-xs"
                              : "bg-white border border-n100 text-n900 rounded-tl-xs"
                          )}
                        >
                          {m.content}
                        </div>
                        <p className={cn("text-[11px] text-n400 mt-1", m.isOwn ? "text-right mr-1" : "ml-1")}>
                          {formatRelative(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Restricted Broadcast Banner */}
        {selectedChat.type === "group" && currentGroup?.messagingMode === "restricted" && !canPostInGroup && (
          <div className="mx-4 mb-2 bg-[#fff8c5] border border-[#9a6700]/20 rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
            <Lock size={16} className="text-[#9a6700] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#9a6700] font-medium leading-normal">
              This group is in broadcast mode. Only group leaders and administrators can post messages.
            </p>
          </div>
        )}

        {/* Composer Footer */}
        {canPostInGroup && (
          <div className="p-3 md:px-6 md:py-4 bg-white border-t border-n100 flex items-center gap-3 shrink-0 shadow-xs">
            <div className="flex-1 flex items-center gap-2 bg-n50 hover:bg-n100/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-caci-blue/20 focus-within:border-caci-blue border border-n200/80 rounded-2xl px-4 py-2.5 transition-all">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  selectedChat.type === "forum"
                    ? `Write a message to ${assemblyName} forum…`
                    : `Write a message to ${currentGroup?.name || "group"}…`
                }
                rows={1}
                className="w-full bg-transparent border-0 outline-none text-[14px] text-n900 placeholder:text-n400 resize-none max-h-28 py-0.5 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!content.trim() || sending}
              className="size-11 rounded-2xl bg-caci-blue hover:bg-[#1e40af] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 disabled:hover:bg-caci-blue disabled:active:scale-100 transition-all cursor-pointer"
              aria-label="Send message"
            >
              <Send size={18} className="translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
