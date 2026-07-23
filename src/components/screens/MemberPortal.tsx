"use client";

import { useEffect } from "react";
import { useApp, type Screen } from "@/lib/store";
import { Sidebar, BottomNav } from "@/components/caci/nav";
import { MemberInbox } from "@/components/screens/member/MemberInbox";
import { MemberGroups } from "@/components/screens/member/MemberGroups";
import { MemberGroupChat } from "@/components/screens/member/MemberGroupChat";
import { MemberBroadcasts } from "@/components/screens/member/MemberBroadcasts";
import { MemberBroadcastDetail } from "@/components/screens/member/MemberBroadcastDetail";
import { MemberSermons } from "@/components/screens/member/MemberSermons";
import { MemberSermonDetail } from "@/components/screens/member/MemberSermonDetail";
import { MemberProfile } from "@/components/screens/member/MemberProfile";
import { MemberProfileEdit } from "@/components/screens/member/MemberProfileEdit";
import { MemberSettings } from "@/components/screens/member/MemberSettings";
import { MemberForum } from "@/components/screens/member/MemberForum";

const screenMap: Record<string, React.ComponentType> = {
  "member-inbox": MemberInbox,
  "member-groups": MemberGroups,
  "member-group-chat": MemberGroups,
  "member-broadcasts": MemberBroadcasts,
  "member-broadcast-detail": MemberBroadcastDetail,
  "member-sermons": MemberSermons,
  "member-sermon-detail": MemberSermonDetail,
  "member-profile": MemberProfile,
  "member-profile-edit": MemberProfileEdit,
  "member-settings": MemberSettings,
  "member-forum": MemberGroups,
};

export function MemberPortal({ screen }: { screen: Screen }) {
  const { resetTo } = useApp();

  useEffect(() => {
    if (screen === "admin" || screen === "member" || screen === "login") {
      resetTo("member-inbox");
    }
    if (screen.startsWith("admin-")) {
      resetTo("member-inbox");
    }
  }, [screen, resetTo]);

  const Screen = screenMap[screen] || MemberInbox;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar role="member" />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-24 md:pb-0">
          <Screen />
        </main>
      </div>
      <BottomNav role="member" />
    </div>
  );
}
