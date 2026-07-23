"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, Phone, Heart, Briefcase, MapPin, Calendar, Shield, AlertCircle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { MemberDTO } from "@/lib/types";
import { attachPhoneInputFormatter } from "@/lib/phone";
import {
  CACIButton, CACIInput, CACITextarea, CACISelect, CACICard, SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";

interface MemberFormState {
  title: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  occupation: string;
  location: string;
  phoneNumber: string;
  whatsappNumber: string;
  membershipStatus: string;
  assemblyRole: string;
  joinDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}

const emptyForm: MemberFormState = {
  title: "", fullName: "", gender: "", dateOfBirth: "", maritalStatus: "",
  occupation: "", location: "", phoneNumber: "", whatsappNumber: "",
  membershipStatus: "visitor", assemblyRole: "", joinDate: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
};

function toFormState(m: MemberDTO): MemberFormState {
  return {
    title: m.title || "",
    fullName: m.fullName,
    gender: m.gender || "",
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split("T")[0] : "",
    maritalStatus: m.maritalStatus || "",
    occupation: m.occupation || "",
    location: m.location || "",
    phoneNumber: m.phoneNumber || "",
    whatsappNumber: m.whatsappNumber || "",
    membershipStatus: m.membershipStatus,
    assemblyRole: m.assemblyRole || "",
    joinDate: m.joinDate ? m.joinDate.split("T")[0] : "",
    emergencyContactName: m.emergencyContactName || "",
    emergencyContactPhone: m.emergencyContactPhone || "",
    emergencyContactRelationship: m.emergencyContactRelationship || "",
  };
}

export function MemberForm({
  mode, memberId, onSuccess, onCancel,
}: {
  mode: "add" | "edit";
  memberId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { back } = useApp();
  const [form, setForm] = useState<MemberFormState>(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const phoneRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);
  const emergPhoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phoneRef.current) return attachPhoneInputFormatter(phoneRef.current);
  }, []);
  useEffect(() => {
    if (whatsappRef.current) return attachPhoneInputFormatter(whatsappRef.current);
  }, []);
  useEffect(() => {
    if (emergPhoneRef.current) return attachPhoneInputFormatter(emergPhoneRef.current);
  }, []);

  // Load existing member for edit mode
  useEffect(() => {
    if (mode !== "edit" || !memberId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await api.members.get(memberId);
        if (mounted) setForm(toFormState(res.member));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load member");
        onCancel();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [mode, memberId, onCancel]);

  const set = (k: keyof MemberFormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the errors before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (mode === "edit" && memberId) {
        await api.members.update(memberId, payload);
        toast.success("Changes saved");
      } else {
        const res = await api.members.create(payload);
        toast.success(`Member added · ${res.member.membershipNumber || ""}`);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "add" ? "Add Member" : "Edit Member";
  const subtitle = mode === "add" ? "Add a new member to the assembly" : "Update member information";

  if (loading) {
    return (
      <>
        <MobileHeader title={title} onBack={back} />
        <DesktopTopBar title={title} subtitle={subtitle} />
        <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl space-y-4">
          <div className="h-40 skeleton-caci rounded-lg" />
          <div className="h-60 skeleton-caci rounded-lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title={title} onBack={back} />
      <DesktopTopBar
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" onClick={onCancel}>Cancel</CACIButton>
            <CACIButton size="sm" loading={saving} onClick={handleSave}>
              {mode === "add" ? "Add Member" : "Save Changes"}
            </CACIButton>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl space-y-4">
        {/* Personal */}
        <CACICard>
          <SectionHeading title="Personal" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACISelect label="Title" value={form.title} onChange={(e) => set("title", e.target.value)}>
              <option value="">—</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Miss">Miss</option>
              <option value="Rev">Rev</option>
              <option value="Elder">Elder</option>
              <option value="Brother">Brother</option>
              <option value="Sister">Sister</option>
              <option value="Pastor">Pastor</option>
              <option value="Dr">Dr</option>
            </CACISelect>
            <CACIInput
              label="Full Name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              error={errors.fullName}
              leftIcon={<User size={16} />}
              required
            />
            <CACISelect label="Gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </CACISelect>
            <CACIInput
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              leftIcon={<Calendar size={16} />}
            />
            <CACISelect label="Marital Status" value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="other">Other</option>
            </CACISelect>
            <CACIInput
              label="Occupation"
              value={form.occupation}
              onChange={(e) => set("occupation", e.target.value)}
              leftIcon={<Briefcase size={16} />}
              placeholder="e.g. Teacher"
            />
          </div>
        </CACICard>

        {/* Contact */}
        <CACICard>
          <SectionHeading title="Contact" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACIInput
              ref={phoneRef}
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(e) => set("phoneNumber", e.target.value)}
              leftIcon={<Phone size={16} />}
              placeholder="024 XXX XXXX"
            />
            <CACIInput
              ref={whatsappRef}
              label="WhatsApp Number"
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              leftIcon={<Phone size={16} />}
              placeholder="024 XXX XXXX"
            />
            <CACIInput
              label="Location"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              leftIcon={<MapPin size={16} />}
              placeholder="e.g. Assakae, Takoradi"
              containerClassName="md:col-span-2"
            />
          </div>
        </CACICard>

        {/* Church */}
        <CACICard>
          <SectionHeading title="Church" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACISelect label="Membership Status" value={form.membershipStatus} onChange={(e) => set("membershipStatus", e.target.value)}>
              <option value="visitor">Visitor</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </CACISelect>
            <CACIInput
              label="Assembly Role"
              value={form.assemblyRole}
              onChange={(e) => set("assemblyRole", e.target.value)}
              leftIcon={<Shield size={16} />}
              placeholder="e.g. Usher, Elder, Choir Member"
            />
            <CACIInput
              label="Join Date"
              type="date"
              value={form.joinDate}
              onChange={(e) => set("joinDate", e.target.value)}
              leftIcon={<Calendar size={16} />}
              containerClassName="md:col-span-2"
            />
          </div>
        </CACICard>

        {/* Emergency Contact */}
        <CACICard>
          <SectionHeading title="Emergency Contact" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACIInput
              label="Contact Name"
              value={form.emergencyContactName}
              onChange={(e) => set("emergencyContactName", e.target.value)}
              leftIcon={<User size={16} />}
              placeholder="Next of kin"
            />
            <CACIInput
              ref={emergPhoneRef}
              label="Contact Phone"
              value={form.emergencyContactPhone}
              onChange={(e) => set("emergencyContactPhone", e.target.value)}
              leftIcon={<Phone size={16} />}
              placeholder="024 XXX XXXX"
            />
            <CACIInput
              label="Relationship"
              value={form.emergencyContactRelationship}
              onChange={(e) => set("emergencyContactRelationship", e.target.value)}
              leftIcon={<Heart size={16} />}
              placeholder="e.g. Spouse, Sibling"
              containerClassName="md:col-span-2"
            />
          </div>
        </CACICard>

        {/* Mobile save bar */}
        <div className="md:hidden flex gap-3 pt-2">
          <CACIButton variant="secondary" className="flex-1" onClick={onCancel}>Cancel</CACIButton>
          <CACIButton className="flex-1" loading={saving} onClick={handleSave}>
            {mode === "add" ? "Add Member" : "Save Changes"}
          </CACIButton>
        </div>
      </div>
    </>
  );
}

export function AdminMemberAdd() {
  const { resetTo } = useApp();
  return (
    <MemberForm
      mode="add"
      onSuccess={() => resetTo("admin-members")}
      onCancel={() => resetTo("admin-members")}
    />
  );
}

export function AdminMemberEdit() {
  const { params, resetTo } = useApp();
  return (
    <MemberForm
      mode="edit"
      memberId={params.memberId}
      onSuccess={() => resetTo("admin-members")}
      onCancel={() => resetTo("admin-members")}
    />
  );
}
