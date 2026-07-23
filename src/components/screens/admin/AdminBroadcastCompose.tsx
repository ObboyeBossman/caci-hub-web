"use client";

import { useEffect, useState } from "react";
import { Send, Users, UsersRound, User, Check, Info, Paperclip } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { GroupDTO, MemberDTO } from "@/lib/types";
import {
  CACIButton, CACIInput, CACITextarea, CACICard, SectionHeading, CACISkeleton,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TargetingMode = "assembly" | "group" | "members";

export function AdminBroadcastCompose() {
  const { back, resetTo } = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [targetingMode, setTargetingMode] = useState<TargetingMode>("assembly");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ recipientCount: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [g, m] = await Promise.all([api.groups.list(), api.members.list({})]);
        setGroups(g.groups);
        setMembers(m.members);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) =>
        m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.phoneNumber || "").includes(memberSearch) ||
        (m.assemblyRole || "").toLowerCase().includes(memberSearch.toLowerCase()),
      )
    : members;

  const toggleMember = (id: string) => {
    setSelectedMembers((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  const handleSend = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!body.trim()) { setError("Message body is required."); return; }
    if (targetingMode === "group" && !targetGroupId) { setError("Please select a target group."); return; }
    if (targetingMode === "members" && selectedMembers.length === 0) { setError("Please select at least one recipient."); return; }

    setSending(true);
    try {
      const res = await api.broadcasts.create({
        title: title.trim(),
        body: body.trim(),
        targetingMode,
        targetGroupId: targetingMode === "group" ? targetGroupId : undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
        notifyMemberIds: targetingMode === "members" ? selectedMembers : undefined,
      });
      setLastResult({ recipientCount: res.recipientCount });
      toast.success(`Broadcast sent to ${res.recipientCount} ${res.recipientCount === 1 ? "recipient" : "recipients"}`);
      // reset form
      setTitle(""); setBody(""); setAttachmentUrl(""); setTargetGroupId(""); setSelectedMembers([]);
      setTimeout(() => resetTo("admin-broadcasts"), 1200);
    } catch (e: any) {
      setError(e?.message || "Failed to send broadcast");
      toast.error(e?.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const targetOptions: { key: TargetingMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "assembly", label: "Assembly-wide", icon: <Users size={16} />, desc: "All active members" },
    { key: "group", label: "Group", icon: <UsersRound size={16} />, desc: "Members of a specific group" },
    { key: "members", label: "Selected Members", icon: <User size={16} />, desc: "Choose individuals" },
  ];

  return (
    <>
      <MobileHeader title="Compose Broadcast" onBack={back} />
      <DesktopTopBar
        title="Compose Broadcast"
        subtitle="Send an announcement to the assembly"
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" onClick={() => resetTo("admin-broadcasts")}>Cancel</CACIButton>
            <CACIButton size="sm" loading={sending} leftIcon={<Send size={15} />} onClick={handleSend}>
              Send Broadcast
            </CACIButton>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl space-y-4">
        {lastResult && (
          <div className="bg-[#dafbe1] border border-[#1a7f37]/20 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
            <Check size={16} className="text-[#1a7f37] shrink-0 mt-0.5" />
            <p className="text-[14px] text-[#1a7f37]">
              Broadcast delivered to {lastResult.recipientCount} {lastResult.recipientCount === 1 ? "recipient" : "recipients"}. Redirecting…
            </p>
          </div>
        )}

        {/* Targeting */}
        <CACICard>
          <SectionHeading title="Send To" className="mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {targetOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTargetingMode(opt.key)}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-colors",
                  targetingMode === opt.key ? "border-caci-blue bg-caci-blue-bg" : "border-n100 hover:border-caci-blue/50",
                )}
              >
                <div className={cn("flex items-center gap-2 mb-1", targetingMode === opt.key ? "text-caci-blue" : "text-n500")}>
                  {opt.icon}
                  <span className="font-semibold text-[14px] text-n900">{opt.label}</span>
                </div>
                <p className="text-[12px] text-n400">{opt.desc}</p>
              </button>
            ))}
          </div>

          {targetingMode === "group" && (
            <div className="mt-4">
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full h-12 rounded-lg border border-n100 bg-white px-3 text-[16px] focus:border-caci-blue focus:ring-2 focus:ring-caci-blue/20 outline-none"
              >
                <option value="">— Select a group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.memberCount} members)</option>
                ))}
              </select>
            </div>
          )}

          {targetingMode === "members" && (
            <div className="mt-4">
              <CACIInput
                placeholder="Search members to add…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                containerClassName="mb-2"
              />
              {selectedMembers.length > 0 && (
                <p className="text-[12px] text-caci-blue font-medium mb-2">
                  {selectedMembers.length} selected
                </p>
              )}
              <div className="max-h-60 overflow-y-auto scroll-caci space-y-1 border border-n100 rounded-lg p-2">
                {loading ? (
                  <p className="text-[13px] text-n400 p-2">Loading members…</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-[13px] text-n400 p-2">No members found.</p>
                ) : (
                  filteredMembers.map((m) => {
                    const checked = selectedMembers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                          checked ? "bg-caci-blue-bg" : "hover:bg-n50",
                        )}
                      >
                        <div className={cn(
                          "size-5 rounded-md border-2 flex items-center justify-center shrink-0",
                          checked ? "bg-caci-blue border-caci-blue" : "border-n200",
                        )}>
                          {checked && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-n900 truncate">
                            {m.title ? `${m.title} ` : ""}{m.fullName}
                          </p>
                          <p className="text-[12px] text-n400 truncate">{m.assemblyRole || m.membershipStatus}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CACICard>

        {/* Message */}
        <CACICard>
          <SectionHeading title="Message" className="mb-4" />
          <div className="space-y-4">
            <CACIInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunday Service Reminder"
              required
            />
            <CACITextarea
              label="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement…"
              className="min-h-[140px]"
              required
            />
            <CACIInput
              label="Attachment URL (optional)"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://…"
              leftIcon={<Paperclip size={16} />}
            />
          </div>
        </CACICard>

        {error && (
          <div className="bg-caci-red-bg border border-caci-red/20 rounded-lg p-3 flex items-start gap-2">
            <Info size={16} className="text-caci-red shrink-0 mt-0.5" />
            <p className="text-[14px] text-caci-red">{error}</p>
          </div>
        )}

        <div className="bg-caci-blue-bg border border-caci-blue/10 rounded-lg p-3 flex items-start gap-2">
          <Info size={16} className="text-caci-blue shrink-0 mt-0.5" />
          <p className="text-[13px] text-caci-blue">
            Each recipient will get a notification in their inbox. Broadcasts are one-way — members cannot reply.
          </p>
        </div>

        <div className="md:hidden flex gap-3 pt-2">
          <CACIButton variant="secondary" className="flex-1" onClick={() => resetTo("admin-broadcasts")}>Cancel</CACIButton>
          <CACIButton className="flex-1" loading={sending} leftIcon={<Send size={16} />} onClick={handleSend}>
            Send Broadcast
          </CACIButton>
        </div>
      </div>
    </>
  );
}
