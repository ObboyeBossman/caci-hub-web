# Membership Shell Consolidation Implementation Plan

This refactoring removes the bespoke tab menus across the Membership Admin section and unifies `MemberList`, `Groups`, `PastoralCare`, `AuditLogs`, and [Reports](file:///home/obboye/dev/caci-hub-web/src/modules/finance/tabs/ReportsTab.ts#21-419) into a central `MembershipWorkspacePage` that utilizes the standard [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#158-353).

## User Review Required

Because Membership previously mapped each tab feature to its own top-level route (`/members`, `/groups`, `/pastoral-care`, `/reports`, `/audit-logs`), unifying them into a [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#158-353) requires shifting the UI entrypoint to `#/membership?tab=xxxxx`.

**Important Changes:**
1. **Route Consolidation**: 
   - `#/members` ➔ `#/membership?tab=members`
   - `#/groups` ➔ `#/membership?tab=groups`
   - `#/pastoral-care` ➔ `#/membership?tab=pastoral`
   - `#/reports` ➔ `#/membership?tab=reports`
   - `#/audit-logs` ➔ `#/membership?tab=audit`
2. **Deep Links Kept Intact**: 
   - Individual resource pages like `#/members/:id`, `#/groups/new`, etc., will remain untouched as full-screen views.
3. **Sidebar Updates**:
   - The main sidebar links will be updated to point to their respective tab variants under `#/membership`.

*Does this approach correctly align with the WorkspaceShell standard you are looking for?*

## Proposed Changes

### Membership Workspace Page
#### [NEW] MembershipWorkspacePage.ts
I will create `src/modules/membership/pages/MembershipWorkspacePage.ts` which instantiates [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#158-353) with a `MEMBERSHIP_CONFIG`.

### Tab Factories
I will wrap the existing page logic for these features into [WorkspaceTab](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#15-23) factories:
#### [NEW] tabs/MembersTab.ts (extracted from MemberList.ts)
#### [NEW] tabs/GroupsTab.ts (extracted from Groups.ts)
#### [NEW] tabs/PastoralTab.ts (extracted from PastoralCare.ts)
#### [NEW] tabs/ReportsTab.ts (Wait, reports routes to MemberList currently, actually I'll create a simple stub for Reports if there wasn't one)
#### [NEW] tabs/AuditLogsTab.ts (extracted from AuditLogs.ts)

*Note: Since they previously rendered inside their own container but called [renderMembershipTab()](file:///home/obboye/dev/caci-hub-web/src/modules/membership/widgets/MembershipTab.ts#50-82), I will remove the [renderMembershipTab()](file:///home/obboye/dev/caci-hub-web/src/modules/membership/widgets/MembershipTab.ts#50-82) function calls from them, leaving pure content that fits flawlessly into [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#158-353).*

### Clean Up and Wire Up
#### [MODIFY] routes.ts
Remove the standalone base routes (`/members`, `/groups`, etc.) and replace them with:
```typescript
{
  path: '/membership',
  page: () => import('./pages/MembershipWorkspacePage'),
  middleware: ['auth', 'mustChangePassword', 'permissions'],
  permission: 'members.view'
}
```
*Note: Deep links (`/members/:id`, `/groups/:id`, etc.) will NOT be removed.*

#### [MODIFY] index.ts
Update the `sidebar` array to point to `/membership?tab=...` respectively.

#### [DELETE] widgets/MembershipTab.ts
Remove the legacy bespoke tab bar code.

## Verification Plan

### Manual Verification
- Revisit `#/membership?tab=members` in the browser. 
- Ensure that the Membership header appears in the new [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/shell/WorkspaceShell.ts#158-353) frame.
- Check Tab Switching: Verify switching to Groups, Pastoral, etc., works flawlessly.
- Check Deep Linking: Clicking on a member card inside the Members tab correctly routes to the `#/members/:id` deep link.
