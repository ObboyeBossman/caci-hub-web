"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Phone, Mail, MapPin, Building2, Lock, Eye, EyeOff, AlertCircle, Church } from "lucide-react";
import { api } from "@/lib/api";
import type { AssemblySettingsDTO } from "@/lib/types";
import { attachPhoneInputFormatter, normalizeGhanaPhone } from "@/lib/phone";
import {
  CACIButton,
  CACICard,
  CACIInput,
  CACITextarea,
  CACISkeleton,
  SectionHeading,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FormState {
  assemblyName: string;
  assemblyLocation: string;
  assemblyAddress: string;
  contactPhone: string;
  contactEmail: string;
  defaultPassword: string;
  forcePasswordReset: boolean;
}

export function AdminSettings() {
  const [settings, setSettings] = useState<AssemblySettingsDTO | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.settings.get();
        if (!mounted) return;
        setSettings(res.settings);
        setForm({
          assemblyName: res.settings.assemblyName || "",
          assemblyLocation: res.settings.assemblyLocation || "",
          assemblyAddress: res.settings.assemblyAddress || "",
          contactPhone: res.settings.contactPhone || "",
          contactEmail: res.settings.contactEmail || "",
          defaultPassword: res.settings.defaultPassword || "",
          forcePasswordReset: res.settings.forcePasswordReset ?? true,
        });
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Attach phone formatter once form loaded
  useEffect(() => {
    if (phoneRef.current) {
      const detach = attachPhoneInputFormatter(phoneRef.current);
      return detach;
    }
  }, [form !== null]);

  const handleSave = async () => {
    if (!form) return;
    setError(null);

    if (!form.assemblyName.trim()) {
      setError("Assembly name is required.");
      return;
    }
    let normalizedPhone: string | null = null;
    if (form.contactPhone.trim()) {
      normalizedPhone = normalizeGhanaPhone(form.contactPhone);
      if (!normalizedPhone) {
        setError("Please enter a valid Ghana contact phone, or leave it blank.");
        return;
      }
    }
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      setError("Please enter a valid contact email, or leave it blank.");
      return;
    }
    if (!form.defaultPassword.trim() || form.defaultPassword.length < 6) {
      setError("Default password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.settings.update({
        assemblyName: form.assemblyName.trim(),
        assemblyLocation: form.assemblyLocation.trim(),
        assemblyAddress: form.assemblyAddress.trim() || null,
        contactPhone: normalizedPhone,
        contactEmail: form.contactEmail.trim() || null,
        defaultPassword: form.defaultPassword,
        forcePasswordReset: form.forcePasswordReset,
      });
      setSettings(res.settings);
      setForm({
        assemblyName: res.settings.assemblyName || "",
        assemblyLocation: res.settings.assemblyLocation || "",
        assemblyAddress: res.settings.assemblyAddress || "",
        contactPhone: res.settings.contactPhone || "",
        contactEmail: res.settings.contactEmail || "",
        defaultPassword: res.settings.defaultPassword || "",
        forcePasswordReset: res.settings.forcePasswordReset ?? true,
      });
      toast.success("Assembly settings saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save settings");
      toast.error(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <>
      <MobileHeader title="Assembly Settings" />
      <DesktopTopBar
        title="Assembly Settings"
        subtitle={settings?.assemblyName || "Configure your assembly"}
        action={
          <CACIButton
            size="sm"
            leftIcon={<Save size={15} />}
            onClick={handleSave}
            loading={saving}
            disabled={!form || loading}
          >
            Save Changes
          </CACIButton>
        }
      />

      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-3xl animate-fade-in">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <CACICard key={i} padding="lg">
                <CACISkeleton className="h-4 w-32 mb-3" />
                <div className="space-y-2">
                  <CACISkeleton className="h-10" />
                  <CACISkeleton className="h-10" />
                </div>
              </CACICard>
            ))}
          </div>
        ) : form ? (
          <>
            {error && (
              <CACICard className="mb-4 border-caci-red/30 bg-caci-red-bg">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-caci-red shrink-0 mt-0.5" />
                  <p className="text-[14px] text-caci-red">{error}</p>
                </div>
              </CACICard>
            )}

            {/* Assembly Identity */}
            <CACICard padding="lg" className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-md bg-caci-blue-bg text-caci-blue">
                  <Church size={16} />
                </div>
                <SectionHeading title="Assembly Identity" />
              </div>
              <div className="space-y-3">
                <CACIInput
                  label="Assembly Name"
                  value={form.assemblyName}
                  onChange={(e) => update("assemblyName", e.target.value)}
                  leftIcon={<Building2 size={18} />}
                  placeholder="Assakae Central Assembly"
                />
                <CACIInput
                  label="Assembly Location"
                  value={form.assemblyLocation}
                  onChange={(e) => update("assemblyLocation", e.target.value)}
                  leftIcon={<MapPin size={18} />}
                  placeholder="Assakae District"
                />
                <CACITextarea
                  label="Assembly Address"
                  value={form.assemblyAddress}
                  onChange={(e) => update("assemblyAddress", e.target.value)}
                  placeholder="Street address, landmarks, etc."
                  className="min-h-[72px]"
                />
              </div>
            </CACICard>

            {/* Contact */}
            <CACICard padding="lg" className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-md bg-caci-blue-bg text-caci-blue">
                  <Phone size={16} />
                </div>
                <SectionHeading title="Contact" />
              </div>
              <div className="space-y-3">
                <CACIInput
                  ref={phoneRef}
                  label="Contact Phone"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone}
                  onChange={(e) => update("contactPhone", e.target.value)}
                  leftIcon={<Phone size={18} />}
                  placeholder="024 XXX XXXX"
                  maxLength={14}
                />
                <CACIInput
                  label="Contact Email"
                  type="email"
                  inputMode="email"
                  value={form.contactEmail}
                  onChange={(e) => update("contactEmail", e.target.value)}
                  leftIcon={<Mail size={18} />}
                  placeholder="assembly@caci.org.gh"
                />
              </div>
            </CACICard>

            {/* Security */}
            <CACICard padding="lg" className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-md bg-caci-red-bg text-caci-red">
                  <Lock size={16} />
                </div>
                <SectionHeading title="Security" />
              </div>
              <div className="space-y-4">
                <CACIInput
                  label="Default Password"
                  type={showPw ? "text" : "password"}
                  value={form.defaultPassword}
                  onChange={(e) => update("defaultPassword", e.target.value)}
                  leftIcon={<Lock size={18} />}
                  placeholder="Set default password for new accounts"
                  rightAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="size-9 flex items-center justify-center rounded-md text-n400 hover:text-n700 hover:bg-n50"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
                <div className="flex items-center justify-between gap-3 rounded-lg border border-n100 p-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-n900">Force password reset</p>
                    <p className="text-[12px] text-n400 mt-0.5">
                      Newly provisioned accounts will be forced to change this password on first login.
                    </p>
                  </div>
                  <Switch
                    checked={form.forcePasswordReset}
                    onCheckedChange={(v) => update("forcePasswordReset", v)}
                    aria-label="Force password reset on first login"
                  />
                </div>
              </div>
            </CACICard>

            {/* Mobile save button */}
            <div className="md:hidden">
              <CACIButton
                className="w-full"
                leftIcon={<Save size={18} />}
                onClick={handleSave}
                loading={saving}
              >
                Save Changes
              </CACIButton>
            </div>
          </>
        ) : (
          <CACICard className="border-caci-red/30 bg-caci-red-bg">
            <p className="text-[14px] text-caci-red">{error || "Failed to load settings."}</p>
          </CACICard>
        )}
      </div>
    </>
  );
}
