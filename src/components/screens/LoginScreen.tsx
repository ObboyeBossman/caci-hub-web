"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CaciLogo, CACIButton, CACIInput } from "@/components/caci/ui";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { attachPhoneInputFormatter, normalizeGhanaPhone } from "@/lib/phone";
import { Eye, EyeOff, Phone, Lock, Info } from "lucide-react";

export function LoginScreen() {
  const { setUser, resetTo } = useApp();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);

  // Attach live phone formatter
  useEffect(() => {
    if (phoneRef.current) {
      const detach = attachPhoneInputFormatter(phoneRef.current);
      return detach;
    }
  }, []);

  // Focus phone on mount
  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError(null);
      setPhoneError(null);

      const normalized = normalizeGhanaPhone(phone);
      if (!normalized) {
        setPhoneError("Please enter a valid Ghana phone number (e.g. 024 XXX XXXX).");
        setShakeKey((k) => k + 1);
        return;
      }
      if (!password) {
        setError("Please enter your password.");
        setShakeKey((k) => k + 1);
        return;
      }

      setLoading(true);
      try {
        const res = await api.auth.login(phone, password);
        setUser(res.user);
        // navigate based on role
        resetTo(res.user.role === "admin" ? "admin-dashboard" : "member-inbox");
      } catch (err: any) {
        const msg = err?.message || "Network error. Please try again.";
        if (msg.toLowerCase().includes("phone")) {
          setPhoneError(msg);
        } else {
          setError(msg);
        }
        setShakeKey((k) => k + 1);
      } finally {
        setLoading(false);
      }
    },
    [phone, password, setUser, resetTo],
  );

  // Quick-fill demo credentials
  const fillAdmin = () => {
    setPhone("024 400 0001");
    setPassword("CACI@2026!");
  };
  const fillMember = () => {
    setPhone("024 400 0002");
    setPassword("CACI@2026!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Brand mark, centred at top */}
      <div className="flex-1 flex flex-col justify-center px-6 pt-12 pb-8 max-w-md mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-10 animate-fade-in">
          <CaciLogo size={72} className="mb-4" />
          <h1 className="text-[24px] font-bold text-caci-blue leading-tight">CACI Hub</h1>
          <p className="text-[14px] text-n400 mt-1">Assakae Central Assembly</p>
          <p className="text-[12px] text-n300 mt-0.5">Christ Apostolic Church International · Ghana</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in" noValidate>
          <div key={shakeKey} className={shakeKey ? "animate-shake" : ""}>
            <CACIInput
              ref={phoneRef}
              label="Phone Number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="024 XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={phoneError}
              leftIcon={<Phone size={18} />}
              disabled={loading}
              maxLength={14}
            />
          </div>

          <CACIInput
            label="Password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={null}
            leftIcon={<Lock size={18} />}
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
            disabled={loading}
          />

          {error && (
            <div className="bg-caci-red-bg border border-caci-red/20 rounded-lg p-3 flex items-start gap-2 animate-fade-in">
              <Info size={16} className="text-caci-red shrink-0 mt-0.5" />
              <p className="text-[14px] text-caci-red">{error}</p>
            </div>
          )}

          <CACIButton
            type="submit"
            size="lg"
            loading={loading}
            className="w-full"
          >
            {loading ? "Signing in…" : "Sign In"}
          </CACIButton>
        </form>

        {/* Demo credentials helper */}
        <div className="mt-6">
          <button
            onClick={() => setShowHelp((s) => !s)}
            className="text-[13px] text-n400 hover:text-caci-blue transition-colors flex items-center gap-1.5"
          >
            <Info size={14} />
            {showHelp ? "Hide demo credentials" : "Show demo credentials"}
          </button>
          {showHelp && (
            <div className="mt-3 rounded-lg border border-n100 bg-n50 p-3 space-y-2 animate-fade-in">
              <p className="text-[12px] text-n400">Tap to auto-fill:</p>
              <div className="flex gap-2">
                <button
                  onClick={fillAdmin}
                  className="flex-1 rounded-md bg-white border border-n100 px-3 py-2 text-left hover:border-caci-blue transition-colors"
                >
                  <p className="text-[12px] font-semibold text-caci-blue">Admin (Pastor)</p>
                  <p className="text-[11px] text-n400">024 400 0001</p>
                </button>
                <button
                  onClick={fillMember}
                  className="flex-1 rounded-md bg-white border border-n100 px-3 py-2 text-left hover:border-caci-blue transition-colors"
                >
                  <p className="text-[12px] font-semibold text-caci-blue">Member (Elder)</p>
                  <p className="text-[11px] text-n400">024 400 0002</p>
                </button>
              </div>
              <p className="text-[11px] text-n400">Password: <span className="font-mono">CACI@2026!</span></p>
            </div>
          )}
        </div>

        <p className="mt-auto pt-8 text-center text-[12px] text-n300">
          Accounts are provisioned by your assembly administrator.
        </p>
      </div>
    </div>
  );
}
