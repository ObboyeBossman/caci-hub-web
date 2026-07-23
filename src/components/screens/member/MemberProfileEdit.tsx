"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, Phone, Heart, Briefcase, MapPin, Calendar, Info,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { MemberDTO } from "@/lib/types";
import { attachPhoneInputFormatter } from "@/lib/phone";
import {
  CACIButton, CACIInput, CACISelect, CACICard, SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { toast } from "sonner";

export function MemberProfileEdit() {
  const { user, back, resetTo } = useApp();
  const [form, setForm] = useState<any>({
    fullName: "", title: "", gender: "", dateOfBirth: "", maritalStatus: "",
    occupation: "", location: "", phoneNumber: "", whatsappNumber: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);
  const emergRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phoneRef.current) return attachPhoneInputFormatter(phoneRef.current);
  }, []);
  useEffect(() => {
    if (whatsappRef.current) return attachPhoneInputFormatter(whatsappRef.current);
  }, []);
  useEffect(() => {
    if (emergRef.current) return attachPhoneInputFormatter(emergRef.current);
  }, []);

  useEffect(() => {
    if (!user?.memberId) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        const res = await api.members.get(user.memberId!);
        if (!mounted) return;
        const m = res.member;
        setForm({
          fullName: m.fullName,
          title: m.title || "",
          gender: m.gender || "",
          dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split("T")[0] : "",
          maritalStatus: m.maritalStatus || "",
          occupation: m.occupation || "",
          location: m.location || "",
          phoneNumber: m.phoneNumber || "",
          whatsappNumber: m.whatsappNumber || "",
          emergencyContactName: m.emergencyContactName || "",
          emergencyContactPhone: m.emergencyContactPhone || "",
          emergencyContactRelationship: m.emergencyContactRelationship || "",
        });
      } catch (e: any) {
        toast.error(e?.message || "Failed to load profile");
        back();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.memberId, back]);

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user?.memberId) return;
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.members.update(user.memberId, form);
      toast.success("Profile updated");
      resetTo("member-profile");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="Edit Profile" onBack={back} />
        <DesktopTopBar title="Edit Profile" />
        <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-2xl space-y-4">
          <div className="h-40 skeleton-caci rounded-lg" />
          <div className="h-60 skeleton-caci rounded-lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Edit Profile" onBack={back} />
      <DesktopTopBar
        title="Edit Profile"
        subtitle="Update your personal information"
        action={
          <div className="flex gap-2">
            <CACIButton variant="secondary" size="sm" onClick={() => resetTo("member-profile")}>Cancel</CACIButton>
            <CACIButton size="sm" loading={saving} onClick={handleSave}>Save Changes</CACIButton>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-2xl space-y-4">
        <div className="bg-caci-blue-bg border border-caci-blue/10 rounded-lg p-3 flex items-start gap-2">
          <Info size={16} className="text-caci-blue shrink-0 mt-0.5" />
          <p className="text-[13px] text-caci-blue">
            Some fields (like membership status and assembly role) are managed by your assembly administrator. Contact them to update those.
          </p>
        </div>

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
              <option value="Dr">Dr</option>
            </CACISelect>
            <CACIInput label="Full Name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} leftIcon={<User size={16} />} required />
            <CACISelect label="Gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </CACISelect>
            <CACIInput label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} leftIcon={<Calendar size={16} />} />
            <CACISelect label="Marital Status" value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="other">Other</option>
            </CACISelect>
            <CACIInput label="Occupation" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} leftIcon={<Briefcase size={16} />} />
          </div>
        </CACICard>

        <CACICard>
          <SectionHeading title="Contact" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACIInput ref={phoneRef} label="Phone Number" value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} leftIcon={<Phone size={16} />} placeholder="024 XXX XXXX" />
            <CACIInput ref={whatsappRef} label="WhatsApp Number" value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} leftIcon={<Phone size={16} />} placeholder="024 XXX XXXX" />
            <CACIInput label="Location" value={form.location} onChange={(e) => set("location", e.target.value)} leftIcon={<MapPin size={16} />} containerClassName="md:col-span-2" />
          </div>
        </CACICard>

        <CACICard>
          <SectionHeading title="Emergency Contact" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CACIInput label="Contact Name" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} leftIcon={<User size={16} />} />
            <CACIInput ref={emergRef} label="Contact Phone" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} leftIcon={<Phone size={16} />} placeholder="024 XXX XXXX" />
            <CACIInput label="Relationship" value={form.emergencyContactRelationship} onChange={(e) => set("emergencyContactRelationship", e.target.value)} leftIcon={<Heart size={16} />} containerClassName="md:col-span-2" />
          </div>
        </CACICard>

        <div className="md:hidden flex gap-3 pt-2">
          <CACIButton variant="secondary" className="flex-1" onClick={() => resetTo("member-profile")}>Cancel</CACIButton>
          <CACIButton className="flex-1" loading={saving} onClick={handleSave}>Save Changes</CACIButton>
        </div>
      </div>
    </>
  );
}
