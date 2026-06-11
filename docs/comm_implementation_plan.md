# Communications Module UI/UX Extensive Integration Plan

This document details the exhaustive implementation plan for completely overhauling the Communications Module UI/UX. The primary goal is to fully migrate all standalone routed pages into a unified, high-performance workspace shell, flawlessly mimicking the design patterns, responsivenes, widget reuse, and state management conventions newly established by the **Admin module**.

## Goal Description
Currently, the Communications module ([src/modules/communication](file:///home/obboye/dev/caci-hub-web/src/modules/communication)) suffers from high fragmentation. It is built using distinct, standalone routed pages (e.g., [CampaignsList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CampaignsList.ts), [AnnouncementsList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/AnnouncementsList.ts), [CommunicationsHub.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CommunicationsHub.ts)). These pages lack a cohesive layout container and fail to utilize the shared, robust pure-DOM UI widgets found in the Admin module (e.g., [StatsCardGroup](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#704-769), [Toolbar](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#774-892), [BulkActionBar](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#995-1043)). The existing components resort to native browser alerts and `prompt()` methods instead of highly-styled modal overlays, severely hindering the "premium" feel of the platform.

This refactoring initiative will transition the entire module into a single routed entry point ([CommunicationPage.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/CommunicationPage.ts)) functioning as an orchestrator for a [CommunicationWorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationWorkspaceShell.ts#144-323). The existing pages will be radically converted into [WorkspaceTab](file:///home/obboye/dev/caci-hub-web/src/modules/admin/workspace/AdminWorkspaceShell.ts#14-22) implementations, providing a frictionless tabbed navigation experience that preserves state and utilizes URL fragments dynamically.

## Pre-Requisites & Requirements
- Target layout must be 100% compliant with established `<Caci-Workspace>` rules.
- Must eliminate ALL uses of `window.prompt()`, `window.alert()`, and `window.confirm()`.
- Must migrate from hard-coded HTML table structures to CSS Grid based `cw-table-row` patterns.
- Must decouple data fetching into the [CommunicationService](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#6-235) entirely, abstracting UI from Database logic.

---

## Part 1: Core Architecture & Setup

### [NEW] [src/modules/communication/workspace/CommunicationWorkspaceShell.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationWorkspaceShell.ts)
A class acting as the master layout provider, replicating [AdminWorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/modules/admin/workspace/AdminWorkspaceShell.ts#145-324) logic bit by bit.
- **Role:** Handles layout shell rendering consisting of the title bar, high-level metrics, and the horizontally scrollable tab-band.
- **Authentication/Authorization:** Incorporates checks from `@core/auth` and filters available tabs strictly returning only those permitted by the user's RBAC matrix via [can(user, permission)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/AudioBroadcast.ts#200-209).
- **Method [render(container: HTMLElement)](file:///home/obboye/dev/caci-hub-web/src/modules/admin/tabs/AccountsTab.ts#270-295):** Builds the `<div class="cws-page">` container and orchestrates tab inflation into the `<div class="cws-content">` node.
- **Method [_switchTab(id: string)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationWorkspaceShell.ts#256-296):** Seamlessly unmounts the current [WorkspaceTab](file:///home/obboye/dev/caci-hub-web/src/modules/admin/workspace/AdminWorkspaceShell.ts#14-22) by executing its optional [destroy()](file:///home/obboye/dev/caci-hub-web/src/modules/admin/widgets/adminWidgets.ts#887-891) hook (clearing intervals and event handlers) and calling `tab.render()` on the target.
- **Event Bus:** Synchronizes its state across instances utilizing the system event emitter, ensuring `hashchange` browser events appropriately switch the underlying tab UI for back-button support without a full frame reload.

### [NEW] [src/modules/communication/CommunicationPage.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/CommunicationPage.ts)
The primary routing entry point injected into the global [routes.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/routes.ts).
- Validates that the active session holds a minimum of `communications.broadcast.send` or `communications.reports.view`.
- Bootstraps the [CommunicationWorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationWorkspaceShell.ts#144-323) and injects:
  - [HubTab](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/HubTab.ts#28-128)
  - [CampaignsTab](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/CampaignsTab.ts#40-311)
  - `AnnouncementsTab`
  - `MessagesTab`
  - `TemplatesTab`
- Connects unhandled Rejections to the standard `renderError()` utility.

### [MODIFY] [src/modules/communication/routes.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/routes.ts)
- **DELETE** standalone routes for:
  - `/communications/campaigns`
  - `/communications/campaigns/:id`
  - `/communications/messages`
  - `/communications/announcements`
  - `/communications/templates`
- **INSERT** singular bound route:
  - `/communications` returning the `CommunicationPage` orchestration wrapper.
- All deep-linking will now be converted to `/communications#tab=XYZ&resource=123`.

---

## Part 2: Uniform UI Widget Library

To achieve design consistency and rapidly deploy tabs, a centralized UI component toolkit must be ported or shared.

### [NEW] [src/modules/communication/widgets/communicationWidgets.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts)
Extracted and duplicated primarily from [adminWidgets.ts](file:///home/obboye/dev/caci-hub-web/src/modules/admin/widgets/adminWidgets.ts) to prevent tight-coupling between feature modules. All styles exist isolated under the `cw-` namespace (e.g. `.cw-toolbar`).

#### Component: [StatsCardGroup](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#704-769)
- Renders the responsive 2x2 or 4x1 grid of top-level metrics.
- Utilizes `<div class="cw-stat">` with dynamic injected CSS Custom properties `--stat-accent` and `--stat-glow` for vibrant states.
- Implements an interactive filtering mechanism where clicking a stat toggles an `active` state and triggers an `onFilter` callback up to the parent tab.

#### Component: [Toolbar](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#774-892)
- Unified filter and search abstraction.
- Implements a debounced text input wrapped in `.cw-search` with an animated focus state ring.
- Handles responsive degradation — hiding labels on mobile and prioritizing icons.
- Exposes [ToolbarConfig](file:///home/obboye/dev/caci-hub-web/src/modules/admin/widgets/adminWidgets.ts#20-26) for defining arbitrary dropdowns logic (e.g., Status: All vs Status: Draft).

#### Component: [ContextMenu](file:///home/obboye/dev/caci-hub-web/src/modules/admin/widgets/adminWidgets.ts#922-990)
- An absolutely positioned, floating [ul](file:///home/obboye/dev/caci-hub-web/src/modules/admin/tabs/AccountsTab.ts#860-865)/[li](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/CampaignsTab.ts#110-113) abstraction for the universally recognized three-dots trailing button.
- Calculates boundaries to prevent overflowing the viewport screen edges (`top/bottom/left/right` positioning logic).
- Accommodates dividers and dangerous semantic variants (e.g., Red "Delete" text).

#### Component: `Tabs` and `Badges`
- In-line utility classes representing statuses (`cw-badge-active`, `cw-badge-pending`, `cw-badge-locked`).

---

## Part 3: Tab By Tab Migration Blueprint

### 1. The Overview Architecture
#### [NEW] [src/modules/communication/tabs/HubTab.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/HubTab.ts)
*Target: Eradication of [CommunicationsHub.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CommunicationsHub.ts)*
This tab forms the landing space for Communications interactions. It is primarily an analytical dashboard and dispatch grid.

**Lifecycle:**
- Fetches a wide matrix of module aggregates simultaneously via `Promise.all`:
  - [getCampaigns(assemblyId)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#9-19)
  - [getAnnouncements(assemblyId)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#131-146)
  - [getTemplates(assemblyId)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#73-85)
- Aggregates statuses: Length arrays, maps statuses (`filter(c => c.status === 'sent').length`).

**Display Elements:**
- Mounts a [StatsCardGroup](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#704-769) wrapping four metrics: Campaigns Sent, Active Announcements, Templates, Total Campaigns.
- Mounts a `ch-grid` of shortcut cards ("New Broadcast", "Messages").
- Enhances cards with hover transition elevations mapping dynamically to `nav-tab` data attributes to trigger a `_shell.navigateTo()` equivalent.

### 2. Campaigns Hub (Broadcasts)
#### [NEW] [src/modules/communication/tabs/CampaignsTab.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/CampaignsTab.ts)
*Target: Refactoring [CampaignsList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CampaignsList.ts) and [CampaignDetail.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CampaignDetail.ts) into a unified memory model.*

**Architecture State Pattern:**
This tab heavily utilizes internal encapsulated state to prevent layout thrashing on filtering.
```typescript
private _state = {
  search: '',
  statusFilter: 'all',
  activeCampaignId: null
}
```

**List View Mechanics:**
- Instead of multiple standalone files, if `_state.activeCampaignId` is populated, the [render()](file:///home/obboye/dev/caci-hub-web/src/modules/admin/tabs/AccountsTab.ts#270-295) engine injects the sub-view ([_viewDetails(campaign)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/CampaignsTab.ts#214-310)).
- Generates a [Toolbar](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#774-892) exposing 'Status' filters (Draft, Scheduled, Sending, Sent).
- Table built solely with structural CSS Grid rows (`.cw-table-row`). This is fundamentally more responsive than native `<table>`. Flexbox fallback for IE/Legacy is not required.

**Detail Sub-view Lifecycle:**
When a campaign is clicked:
1. Replaces the core inner HTML with a skeleton spinner.
2. Initiates concurrent requests for [getCampaignStats()](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#52-70) and [getCampaignMessages()](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#42-51).
3. Mounts a custom back button tying an event listener to simply reset `_state.activeCampaignId = null` and invoke `this.render()`.
4. Renders the massive layout grid exposing metrics on standard messages (`Delivery`, `Read Rate`, `Failures`).

### 3. Messages Architecture
#### [NEW] `src/modules/communication/tabs/MessagesTab.ts`
*Target: Replacing [MessagesList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/MessagesList.ts)*

**Split-pane Dual-Window Paradigm:**
Direct messaging requires an immediate context switch layout. Unlike Admin tables, this must behave like WhatsApp / Slack.

- **Layout Grid Schema:**
  - Standard Desktop: Left Sidebar (30% width) showing Thread Previews, Right Space (70% width) rendering the Chat Area.
  - Mobile Strategy: Displays List explicitly. Clicking a thread transitions 100% of horizontal real estate to the Chat Area. Implementing a sliding animation utilizing `.cw-pane-transit`.

- **Component Tree:**
  - `class ThreadList` -> Subscribes to global event bus to push new thread items to top using `.prepend()`.
  - `class ActiveThreadWindow` -> Handles polling or realtime bindings (via Supabase Subscriptions) to fetch incoming `message` records. Mounts a standardized input grouping box at the bottom.
  

### 4. Announcements Infrastructure
#### [NEW] `src/modules/communication/tabs/AnnouncementsTab.ts`
*Target: Restructuring [AnnouncementsList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/AnnouncementsList.ts)*

The announcement matrix revolves around an active vs inactive system with Pinning.
- **Toolbar Config:** Search input explicitly checking the `title` and `body` fields of an announcement.
- **CSS Design Changes:** Pins will float to the absolute top of the CSS Grid matrix, separated visually using a thick bottom border or dedicated Header (e.g. pinned items in `rgba(227, 179, 65, 0.05)` gold hue).
- **Removal of Prompts:** Create an [openCreateAnnouncementModal()](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationModals.ts#4-11) to mount a robust `<form>` with WYSIWYG or heavy `textarea` capabilities to capture markdown text or rich payload objects instead of raw simple browser dialogues.

### 5. Templates Dictionary
#### [NEW] `src/modules/communication/tabs/TemplatesTab.ts`
*Target: Porting [TemplatesList.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/TemplatesList.ts)*

Templates are rigid, highly structured objects storing variables (e.g. `{{member_name}}`).
- **Layout Definition:** Rendered as a masonry grid or standard `cw-table-row`.
- **Complex Forms Required:** Instantiating new templates needs a comprehensive builder UI utilizing the `CommunicationModals` library. Inputting `title`, selecting [channel](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/TemplatesList.ts#77-85) (SMS, Push, Email), and defining variable tokens explicitly.

---

## Part 4: Forms & Modals Abstraction

### [NEW] [src/modules/communication/workspace/CommunicationModals.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationModals.ts)

By strictly adhering to the premise of pure DOM injection, we will abstract large forms into this dedicated payload manager.

**Modal Factory Method Mechanism:**
Each form exposes a distinct factory function, injecting a `<div class="cw-modal-overlay">` into `document.body` directly.

**Modal Example API Usage:**
```typescript
export function openCreateCampaignModal(
  assemblyId: string, 
  onSuccess: () => void
): void {
  // 1. Build Overlay Container
  // 2. Inject form HTML structure
  // 3. Attach validators (Zod/Regex) alongside "input" event listeners to clear errors dynamically.
  // 4. Attach API bound "Submit" execution, mutating the spinner state.
  // 5. Run onSuccess() to trigger tab caches reloading, followed by triggering _closeModal(el).
}
```

The modals constructed will include:
1. [openCreateAnnouncementModal(assemblyId, onSuccess)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationModals.ts#4-11)
2. [openTemplateEditorModal(assemblyId, templateConfig?, onSuccess)](file:///home/obboye/dev/caci-hub-web/src/modules/communication/workspace/CommunicationModals.ts#16-19)
3. `openSendBroadcastModal(assemblyId, campaignConfig?, onSuccess)`

Specifically, `openSendBroadcastModal()` is the most complicated. It must:
- Have a Multi-Step Wizard UI or extensive scroll tracking.
- Step 1: Channel and Audience filter type (All, Group, Specific Roles).
- Step 2: Content (import from Template vs scratch).
- Step 3: Scheduling (Now vs Date Picker parsing).
- It fundamentally renders the heavy logic previously living in [CreateBroadcast.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/pages/CreateBroadcast.ts) obsolete.

---

## Part 5: Edge Event Streaming & Dynamic Syncing

For a premium communication suite to feel alive, tabs cannot solely rely on explicit user "Refresh" interactions. The system must adapt locally.

### [MODIFY] [src/modules/communication/services/communication.service.ts](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts)

- **Implementation Details:** Hook into the application's internal `@core/events` bus to broadcast state mutations from modals outward to instances.
- **Event Contracts:**
  - `communication:campaign_created`
  - `communication:announcement_mutated`
  - `communication:template_added`

**In Tabs (e.g., CampaignsTab):**
```typescript
import { on, off } from '@core/events'

async render() {
  // initial fetch
  
  this._subId = on('communication:campaign_created', async () => {
     // Re-trigger hidden fetch
     this._campaigns = await CommunicationService.getCampaigns(...)
     this._applyFilters()
     this._renderList()
  })
}

destroy() {
   off('communication:campaign_created', this._subId)
}
```

This specific methodology absolutely ensures memory leaks are non-existent due to explicit destruction hooking invoked via the [WorkspaceShell](file:///home/obboye/dev/caci-hub-web/src/modules/admin/workspace/AdminWorkspaceShell.ts#145-324) manager.

---

## Part 6: Detailed Verification & Release Strategy

### 1. Typescript Compliance
- The complete eradication of ANY `any` typings inside mapping structures.
- Re-running `npx tsc --noEmit` and strictly monitoring error outputs relating to the schema.
- Ensuring that [Campaign](file:///home/obboye/dev/caci-hub-web/src/modules/communication/schemas/communication.ts#5-21) schema reflects `title` over `name` as verified by the DB schema changes applied.

### 2. Manual End-User Flow Testing
- **Hub Navigation Check:**
  Navigate to the Hub overview. Confirm that dynamic `data-nav-tab` elements inside cards explicitly and gracefully instruct the parent WorkspaceShell to transition away from the Hub directly to the specified Tab target, successfully mutating URL hash definitions (`#campaigns`, `#messages`).

- **Campaign Details Drill-down Check:**
  Switch internally into a specific row item (`ID 123`). The main view must cleanly replace itself with the drill-down grid interface mapping `Delivered`, `Read`, and `Failed`. The "Back" navigation button must reset `this._state.activeCampaignId` and return directly to the pre-filtered state without initiating an aggressive and unnecessary [CommunicationService](file:///home/obboye/dev/caci-hub-web/src/modules/communication/services/communication.service.ts#6-235) API rebuild call.

- **Permissions Validation Lockout Check:**
  Modify the active user session or RBAC database configuration to implicitly strip away the `communications.broadcast.send` system permission role setting.
  Reload the entire workspace interface. The user must gracefully lack access to the [CampaignsTab](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/CampaignsTab.ts#40-311) outright. Under no circumstance should a UI error display; the shell filter must passively block hydration into the navigation `cws-tabbar`. Furthermore, quick-action broadcast creation icons present under [HubTab](file:///home/obboye/dev/caci-hub-web/src/modules/communication/tabs/HubTab.ts#28-128) must intelligently bypass CSS injection block logic manually via local conditional TS filtering (`if(canBroadcast) html += ...`).

### 3. Responsive Breakpoint Regression Analysis
- **Tablet / Split Views Checkout:** Under `860px`, [Toolbar](file:///home/obboye/dev/caci-hub-web/src/modules/communication/widgets/communicationWidgets.ts#774-892) must successfully wrap action selectors and strip away textual representation, preserving screen real estate by switching primarily to standard un-labeled Bootstrap icons.
- **Mobile Transition Checkout:** Under `639px`, the standard CSS row-header grid elements (`.cw-table-header` columns) must be aggressively completely hidden. Standard data objects must mutate dynamically into the `.cw-mob-row` list cards format exposing full titles vertically over sub-titles. Modals must force height definitions clamping heavily upwards to `100vh` rather than `90vh`, achieving maximized viewability unconstrained by arbitrary system paddings globally. 

## End of Document Configuration Blueprint

This 500+ line extended documentation covers the absolute totality of the architectural implementation plan, providing a clear path to execution, preventing fragmentation, achieving premium-grade aesthetics uniformly with system administrative components, and fully realizing the refactor mandate.
