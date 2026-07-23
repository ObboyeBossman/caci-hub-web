"use client";

import { useEffect, useState } from "react";
import {
  Phone, MessageCircle, MapPin, Calendar, Briefcase, Heart, User,
  Shield, Users, Edit, Trash2, ExternalLink, Clock,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { MemberDTO, GroupDTO, AuditLogDTO } from "@/lib/types";
import { formatDate, formatDateTime, formatRelative, formatPhoneDisplay, humanizeField } from "@/lib/format";
import {
  CACIButton, CACICard, CaciAvatar, CACISkeleton, EmptyState,
  MembershipStatusBadge, RoleBadge, SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function AdminMemberDetail() {
  const { params, navigate, back, setParam } = useApp();
  const memberId = params.memberId;
  const [member, setMember] = useState<MemberDTO | null>(null);
  const [groups, setGroups] = useState<GroupDTO[]>([]);
  const [audit, setAudit] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!memberId) {
      back();
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [m, g, a] = await Promise.all([
          api.members.get(memberId),
          api.groups.list({ memberId }),
          api.audit.list(memberId, 5),
        ]);
        if (!mounted) return;
        setMember(m.member);
        setGroups(g.groups);
        setAudit(a.logs);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load member");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, back]);

  const handleRemove = async () => {
    if (!member) return;
    setRemoving(true);
    try {
      await api.members.remove(member.id);
      toast.success(`${member.fullName} has been removed`);
      back();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  const goToGroup = (id: string) => {
    setParam("groupId", id);
    navigate("admin-group-detail");
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="Member" onBack={back} />
        <DesktopTopBar title="Member Profile" />
        <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-4xl space-y-4">
          <CACICard className="flex items-center gap-4">
            <CACISkeleton className="size-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <CACISkeleton className="h-6 w-1/2" />
              <CACISkeleton className="h-4 w-1/3" />
            </div>
          </CACICard>
          {[0, 1, 2].map((i) => (
            <CACICard key={i}>
              <div className="space-y-3">
                <CACISkeleton className="h-4 w-1/4" />
                <CACISkeleton className="h-4 w-3/4" />
                <CACISkeleton className="h-4 w-2/3" />
              </div>
            </CACICard>
          ))}
        </div>
      </>
    );
  }

  if (!member) {
    return (
      <>
        <MobileHeader title="Member" onBack={back} />
        <DesktopTopBar title="Member Profile" />
        <EmptyState title="Member not found" description="This member may have been removed." action={<CACIButton onClick={back}>Go back</CACIButton>} />
      </>
    );
  }

  return (
    <>
      <MobileHeader title={member.fullName} subtitle={member.membershipNumber || undefined} onBack={back} />
      <DesktopTopBar
        title={member.fullName}
        subtitle={member.membershipNumber || undefined}
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" leftIcon={<Edit size={15} />} onClick={() => navigate("admin-member-edit")}>
              Edit
            </CACIButton>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <CACIButton variant="danger" size="sm" leftIcon={<Trash2 size={15} />}>
                  Remove
                </CACIButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {member.fullName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will soft-delete the member record. Their data is preserved but they will be hidden from the active directory. This action can be reversed from the &quot;Show deleted&quot; filter.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemove}
                    disabled={removing}
                    className="bg-caci-red text-white hover:bg-caci-red-light"
                  >
                    {removing ? "Removing…" : "Remove Member"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-4xl space-y-4">
        {/* Profile header */}
        <CACICard padding="lg" className="flex flex-col items-center text-center md:flex-row md:text-left md:items-start gap-4">
          <CaciAvatar name={member.fullName} photoUrl={member.profilePhotoUrl} size={80} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-n900">
              {member.title ? `${member.title} ` : ""}{member.fullName}
            </h2>
            {member.assemblyRole && (
              <p className="text-[14px] text-caci-blue font-medium mt-0.5">{member.assemblyRole}</p>
            )}
            <div className="flex items-center justify-center md:justify-start gap-2 mt-2 flex-wrap">
              <MembershipStatusBadge status={member.membershipStatus} />
              <span className="text-[12px] text-n400">·</span>
              <span className="text-[12px] text-n400">Member since {formatDate(member.joinDate)}</span>
            </div>
            {member.membershipNumber && (
              <p className="text-[12px] text-n300 mt-1 font-mono">{member.membershipNumber}</p>
            )}
          </div>
        </CACICard>

        {/* Contact */}
        <CACICard>
          <SectionHeading title="Contact" className="mb-3" />
          <div className="space-y-2.5">
            <ContactRow icon={<Phone size={16} />} label="Phone" value={formatPhoneDisplay(member.phoneNumber)} href={member.phoneNumber ? `tel:+${member.phoneNumber}` : undefined} />
            <ContactRow icon={<MessageCircle size={16} />} label="WhatsApp" value={formatPhoneDisplay(member.whatsappNumber)} href={member.whatsappNumber ? `https://wa.me/${member.whatsappNumber}` : undefined} />
            <ContactRow icon={<MapPin size={16} />} label="Location" value={member.location} />
          </div>
        </CACICard>

        {/* Personal */}
        <CACICard>
          <SectionHeading title="Personal" className="mb-3" />
          <div className="space-y-2.5">
            <ContactRow icon={<Calendar size={16} />} label="Date of Birth" value={formatDate(member.dateOfBirth)} />
            <ContactRow icon={<User size={16} />} label="Gender" value={member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : null} />
            <ContactRow icon={<Heart size={16} />} label="Marital Status" value={member.maritalStatus ? member.maritalStatus.charAt(0).toUpperCase() + member.maritalStatus.slice(1) : null} />
            <ContactRow icon={<Briefcase size={16} />} label="Occupation" value={member.occupation} />
          </div>
        </CACICard>

        {/* Emergency contact */}
        {(member.emergencyContactName || member.emergencyContactPhone) && (
          <CACICard>
            <SectionHeading title="Emergency Contact" className="mb-3" />
            <div className="space-y-2.5">
              <ContactRow icon={<User size={16} />} label="Name" value={member.emergencyContactName} />
              <ContactRow icon={<Phone size={16} />} label="Phone" value={formatPhoneDisplay(member.emergencyContactPhone)} href={member.emergencyContactPhone ? `tel:+${member.emergencyContactPhone}` : undefined} />
              <ContactRow icon={<Heart size={16} />} label="Relationship" value={member.emergencyContactRelationship} />
            </div>
          </CACICard>
        )}

        {/* Portal account */}
        <CACICard>
          <SectionHeading title="Portal Account" className="mb-3" />
          {member.authUserId ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-caci-blue-bg text-caci-blue flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-n900">Account linked</p>
                  <p className="text-[12px] text-n400">Can sign in to CACI Hub</p>
                </div>
              </div>
              <RoleBadge role="member" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-n50 text-n400 flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-n700">No portal account</p>
                  <p className="text-[12px] text-n400">Provision one to enable sign-in</p>
                </div>
              </div>
              <CACIButton size="sm" variant="secondary" onClick={() => navigate("admin-accounts")}>
                Provision
              </CACIButton>
            </div>
          )}
        </CACICard>

        {/* Groups */}
        <CACICard>
          <SectionHeading
            title="Groups"
            action={groups.length > 0 ? <span className="text-[13px] text-n400">{groups.length}</span> : undefined}
            className="mb-3"
          />
          {groups.length === 0 ? (
            <p className="text-[14px] text-n400 py-2">Not a member of any group.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => goToGroup(g.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-n50 text-left transition-colors"
                >
                  <div className="size-9 rounded-lg bg-caci-blue-bg text-caci-blue flex items-center justify-center shrink-0">
                    <Users size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-n900 truncate">{g.name}</p>
                    <p className="text-[12px] text-n400">{g.memberCount} members</p>
                  </div>
                  {g.leaderId === member.id && (
                    <span className="text-[11px] bg-caci-red-bg text-caci-red px-2 py-0.5 rounded-full font-medium">Leader</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CACICard>

        {/* Permissions */}
        {member.permissions && member.permissions.length > 0 && (
          <CACICard>
            <SectionHeading title="Granted Permissions" className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {member.permissions.map((p) => (
                <span key={p} className="text-[12px] bg-caci-blue-bg text-caci-blue px-2.5 py-1 rounded-md font-medium">
                  {p}
                </span>
              ))}
            </div>
          </CACICard>
        )}

        {/* Recent audit */}
        <CACICard>
          <SectionHeading
            title="Recent Changes"
            action={
              audit.length > 0 ? (
                <button onClick={() => navigate("admin-audit")} className="text-[13px] text-caci-blue hover:underline flex items-center gap-1">
                  View all <ExternalLink size={12} />
                </button>
              ) : undefined
            }
            className="mb-3"
          />
          {audit.length === 0 ? (
            <p className="text-[14px] text-n400 py-2">No changes recorded.</p>
          ) : (
            <div className="space-y-3">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-[13px]">
                  <Clock size={14} className="text-n400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-n700">
                      <span className="font-medium">{humanizeField(a.fieldChanged)}</span>
                      {a.oldValue && a.newValue ? ` changed from "${a.oldValue}" to "${a.newValue}"` : a.newValue ? ` set to "${a.newValue}"` : a.oldValue ? ` cleared (was "${a.oldValue}")` : ""}
                    </p>
                    <p className="text-[12px] text-n400">{a.changedByName || "System"} · {formatRelative(a.changedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CACICard>
      </div>
    </>
  );
}

function ContactRow({
  icon, label, value, href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const display = value || "—";
  return (
    <div className="flex items-center gap-3">
      <span className="text-n400 shrink-0">{icon}</span>
      <span className="text-[13px] text-n400 w-28 shrink-0">{label}</span>
      {href && value ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-[14px] text-caci-blue hover:underline truncate">
          {display}
        </a>
      ) : (
        <span className={`text-[14px] truncate ${value ? "text-n900" : "text-n300"}`}>{display}</span>
      )}
    </div>
  );
}
