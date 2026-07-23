"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollText, ArrowRight, User, Clock, Filter } from "lucide-react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { AuditLogDTO } from "@/lib/types";
import { formatDateTime, formatRelative, humanizeField } from "@/lib/format";
import {
  CACICard,
  CACISkeleton,
  EmptyState,
  CaciAvatar,
} from "@/components/caci/ui";
import { MobileHeader, DesktopTopBar } from "@/components/caci/nav";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "membership" | "phone" | "role" | "delete";

const filterDefs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "membership", label: "Membership" },
  { key: "phone", label: "Phone" },
  { key: "role", label: "Role" },
  { key: "delete", label: "Soft Delete" },
];

function matchesFilter(log: AuditLogDTO, key: FilterKey): boolean {
  if (key === "all") return true;
  const f = log.fieldChanged.toLowerCase();
  if (key === "membership") return f.includes("membership") || f.includes("status") || f.includes("active");
  if (key === "phone") return f.includes("phone");
  if (key === "role") return f.includes("role") || f.includes("title");
  if (key === "delete") return f.includes("delete") || f.includes("member_deleted");
  return false;
}

export function AdminAudit() {
  const { setParam, navigate } = useApp();
  const [logs, setLogs] = useState<AuditLogDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        const res = await api.audit.list(undefined, 100);
        if (mounted) setLogs(res.logs);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load audit log");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => matchesFilter(l, filter));
  }, [logs, filter]);

  const openMember = (memberId: string) => {
    setParam("memberId", memberId);
    navigate("admin-member-detail");
  };

  return (
    <>
      <MobileHeader title="Audit Log" subtitle="Immutable change history" />
      <DesktopTopBar
        title="Audit Log"
        subtitle="Immutable change history"
        action={
          <div className="hidden md:flex items-center gap-2 text-[13px] text-n400">
            <Filter size={14} /> Filter by category
          </div>
        }
      />

      <div className="px-4 py-4 md:px-8 md:py-6 max-w-md mx-auto md:max-w-6xl animate-fade-in">
        {error && (
          <CACICard className="mb-4 border-caci-red/30 bg-caci-red-bg">
            <p className="text-[14px] text-caci-red">{error}</p>
          </CACICard>
        )}

        {/* Filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 mb-4 -mx-1 px-1">
          {filterDefs.map((f) => {
            const active = filter === f.key;
            const count =
              f.key === "all"
                ? logs?.length ?? 0
                : logs?.filter((l) => matchesFilter(l, f.key)).length ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors border",
                  active
                    ? "bg-caci-blue text-white border-caci-blue"
                    : "bg-white text-n500 border-n100 hover:border-caci-blue hover:text-caci-blue",
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className={cn("ml-1.5 text-[11px]", active ? "text-white/70" : "text-n400")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <CACISkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="space-y-3">
              {filtered.map((log) => (
                <AuditEntry key={log.id} log={log} onOpenMember={openMember} />
              ))}
            </div>
            <p className="text-center text-[12px] text-n400 mt-6">
              Loaded {filtered.length} of {logs?.length ?? 0} entries
            </p>
          </>
        ) : (
          <EmptyState
            icon={<ScrollText size={20} />}
            title={logs && logs.length > 0 ? "No entries match this filter" : "No audit entries yet"}
            description={
              logs && logs.length > 0
                ? "Try a different filter category."
                : "Member changes will be recorded here automatically."
            }
          />
        )}
      </div>
    </>
  );
}

function AuditEntry({ log, onOpenMember }: { log: AuditLogDTO; onOpenMember: (id: string) => void }) {
  const isDelete = log.fieldChanged.toLowerCase().includes("delete");
  const isCreate = log.fieldChanged === "MEMBER_CREATED";
  return (
    <CACICard padding="default">
      <div className="flex items-start gap-3">
        <CaciAvatar name={log.memberName || "Unknown"} size={36} />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenMember(log.memberId)}
            className="text-[14px] font-semibold text-n900 hover:text-caci-blue hover:underline text-left truncate block max-w-full"
          >
            {log.memberName || "Unknown member"}
          </button>
          <p className="text-[12px] text-n400 mt-0.5">
            <span className="font-medium text-n500">{humanizeField(log.fieldChanged)}</span>
          </p>

          <div className="mt-2 flex items-center gap-2 flex-wrap text-[12px]">
            {isDelete ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-caci-red-bg text-caci-red text-[11px] font-medium">
                Member removed
              </span>
            ) : isCreate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#dafbe1] text-[#1a7f37] text-[11px] font-medium">
                Member added
              </span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {log.oldValue !== null && log.oldValue !== "" && (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-n50 text-n500 font-mono text-[11px] line-through decoration-n300/60 max-w-[140px] truncate">
                      {log.oldValue || "—"}
                    </span>
                    <ArrowRight size={12} className="text-n400 shrink-0" />
                  </>
                )}
                <span className="px-1.5 py-0.5 rounded bg-caci-blue-bg text-caci-blue font-mono text-[11px] max-w-[140px] truncate">
                  {log.newValue || "—"}
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3 text-[11px] text-n400 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {log.changedByName || "System"}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={formatDateTime(log.changedAt)}
            >
              <Clock size={11} /> {formatRelative(log.changedAt)}
            </span>
          </div>
        </div>
      </div>
    </CACICard>
  );
}
