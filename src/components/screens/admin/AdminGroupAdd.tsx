"use client";

import { useEffect, useState } from "react";
import { UsersRound, Crown, Lock, Unlock, Info } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { MemberDTO } from "@/lib/types";
import {
  CACIButton, CACIInput, CACITextarea, CACISelect, CACICard, SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminGroupAdd() {
  const { back, resetTo } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [messagingMode, setMessagingMode] = useState<"open" | "restricted">("open");
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.members.list({});
        setMembers(res.members);
      } catch {}
    })();
  }, []);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.groups.create({
        name: name.trim(),
        description: description.trim() || undefined,
        leaderId: leaderId || undefined,
        messagingMode,
      });
      toast.success("Group created");
      resetTo("admin-groups");
    } catch (e: any) {
      setError(e?.message || "Failed to create group");
      toast.error(e?.message || "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MobileHeader title="New Group" onBack={back} />
      <DesktopTopBar
        title="New Group"
        subtitle="Create a fellowship, ministry, or department"
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" onClick={() => resetTo("admin-groups")}>Cancel</CACIButton>
            <CACIButton size="sm" loading={saving} onClick={handleCreate}>Create Group</CACIButton>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-2xl space-y-4">
        <CACICard>
          <SectionHeading title="Group Details" className="mb-4" />
          <div className="space-y-4">
            <CACIInput
              label="Group Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Youth Fellowship"
              error={error && error.includes("name") ? error : null}
              leftIcon={<UsersRound size={16} />}
              required
            />
            <CACITextarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about? Meeting times, purpose, etc."
              className="min-h-[80px]"
            />
            <CACISelect label="Leader" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              <option value="">— Select a leader —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title ? `${m.title} ` : ""}{m.fullName}{m.assemblyRole ? ` — ${m.assemblyRole}` : ""}
                </option>
              ))}
            </CACISelect>
            {leaderId && (
              <div className="flex items-center gap-2 text-[12px] text-n400 bg-n50 rounded-md p-2">
                <Crown size={14} className="text-caci-red" />
                The leader will be automatically added as a member.
              </div>
            )}
          </div>
        </CACICard>

        <CACICard>
          <SectionHeading title="Messaging Mode" className="mb-3" />
          <div className="space-y-2">
            <button
              onClick={() => setMessagingMode("open")}
              className={cn(
                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                messagingMode === "open" ? "border-caci-blue bg-caci-blue-bg" : "border-n100 hover:border-caci-blue/50",
              )}
            >
              <div className="flex items-center gap-2">
                <Unlock size={16} className={messagingMode === "open" ? "text-caci-blue" : "text-n400"} />
                <span className="font-semibold text-n900 text-[14px]">Open</span>
              </div>
              <p className="text-[12px] text-n500 mt-1 ml-6">Any member of the group can send messages.</p>
            </button>
            <button
              onClick={() => setMessagingMode("restricted")}
              className={cn(
                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                messagingMode === "restricted" ? "border-caci-blue bg-caci-blue-bg" : "border-n100 hover:border-caci-blue/50",
              )}
            >
              <div className="flex items-center gap-2">
                <Lock size={16} className={messagingMode === "restricted" ? "text-caci-blue" : "text-n400"} />
                <span className="font-semibold text-n900 text-[14px]">Restricted</span>
              </div>
              <p className="text-[12px] text-n500 mt-1 ml-6">Only the group leader and admins can send messages.</p>
            </button>
          </div>
        </CACICard>

        {error && !error.includes("name") && (
          <div className="bg-caci-red-bg border border-caci-red/20 rounded-lg p-3 flex items-start gap-2">
            <Info size={16} className="text-caci-red shrink-0 mt-0.5" />
            <p className="text-[14px] text-caci-red">{error}</p>
          </div>
        )}

        <div className="md:hidden flex gap-3 pt-2">
          <CACIButton variant="secondary" className="flex-1" onClick={() => resetTo("admin-groups")}>Cancel</CACIButton>
          <CACIButton className="flex-1" loading={saving} onClick={handleCreate}>Create Group</CACIButton>
        </div>
      </div>
    </>
  );
}
