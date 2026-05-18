# CAC Hub Web — Folder Structure v3
# Changes from v2:
#   - Households pages added to membership module (4 pages: list, detail, create, edit)
#   - Household types added to member.types.ts
#   - Household schema added to membership/schemas/
#   - repository.ts household methods expanded (was getHouseholds() only)
#   - admin/ module stub added (enabled: false) — 3 pages stubbed, matches Flutter
#   - admin module registered in main.ts alongside other disabled modules
#   - memberCache.ts + groupCache.ts added to shared/utils/ (from cache design doc)
#   - Skeleton variant table updated: HouseholdList, HouseholdDetail, HouseholdCreate, HouseholdEdit added

caci-hub-web/
│
├── index.html                          ← SPA shell; single <div id="app">
├── vite.config.ts                      ← Vite config; path aliases, build output
│                                          aliases: @core, @shared, @types, @modules
├── package.json
├── tsconfig.json                       ← strict: true, moduleResolution: bundler
│                                          paths mirror vite aliases
├── .env                                ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── .env.example
├── .gitignore
└── README.md
│
│
├── public/
│   ├── caci-logo.png
│   ├── favicon.ico
│   └── manifest.json                   ← PWA manifest (vite-plugin-pwa source)
│
│
├── src/
│   │
│   ├── main.ts                         ← registers all modules → boots app
│   │                                      includes AdminModule (enabled: false)
│   │
│   │
│   ├── types/                          ← all TypeScript contracts live here
│   │   │
│   │   ├── database.types.ts           ← AUTO-GENERATED — never edit manually
│   │   │                                  command: npx supabase gen types typescript
│   │   │                                           --project-id <id> > src/types/database.types.ts
│   │   │                                  regenerate after every new migration
│   │   │                                  exports: Database (Tables, Views, Enums, Functions)
│   │   │
│   │   ├── member.types.ts             ← MemberRow, MemberView, MemberFilter,
│   │   │                                  CreateMemberPayload, UpdateMemberPayload,
│   │   │                                  MemberStats, MemberStatus, Gender, MaritalStatus
│   │   │                                  NEW: HouseholdRow, HouseholdView,
│   │   │                                       CreateHouseholdPayload, UpdateHouseholdPayload,
│   │   │                                       HouseholdFilter, HouseholdWithMembers
│   │   │                                  mirrors: member.dart, household.dart,
│   │   │                                           create_member_request.dart,
│   │   │                                           update_member_request.dart,
│   │   │                                           member_filter.dart, household_filter.dart
│   │   │
│   │   ├── auth.types.ts               ← AppUser, UserRole, UserProfile
│   │   │                                  mirrors: auth_provider.dart user shape
│   │   │
│   │   ├── module.types.ts             ← ModuleManifest, RouteDefinition, PageModule,
│   │   │                                  SidebarItem, WidgetDefinition, ModuleContext,
│   │   │                                  Capability
│   │   │                                  NOTE: PageModule is the page rendering contract:
│   │   │                                    interface PageModule {
│   │   │                                      render(container: HTMLElement): Promise<void>
│   │   │                                      destroy?(): void
│   │   │                                    }
│   │   │                                  Every page file must export a PageModule as default
│   │   │
│   │   └── common.types.ts             ← PaginatedResult<T>, ApiResponse<T>,
│   │                                      RepositoryError, LoadState
│   │                                      LoadState = 'loading' | 'success' | 'empty' | 'error'
│   │
│   │
│   ├── styles/
│   │   ├── theme.css                   ← CACI brand tokens as CSS custom properties
│   │   │                                  --caci-red, --caci-gold, --caci-navy, --caci-green
│   │   │                                  --sidebar-width, --toolbar-height
│   │   │                                  source: caci_design_system.dart
│   │   │                                         caci_ghana_brand_palette.html
│   │   │
│   │   ├── shell.css                   ← sidebar, toolbar, breadcrumbs, layout grid
│   │   │                                  sticky sidebar, collapsible on mobile
│   │   │
│   │   ├── auth.css                    ← centered card, logo, TOTP digit boxes
│   │   │                                  source: caci_hub_auth_module.html
│   │   │                                         caci_auth_redesigned.html
│   │   │                                         caci_totp_merged.html
│   │   │
│   │   ├── membership.css              ← member list table, profile card, avatar,
│   │   │                                  stat cards, status badges, filter drawer,
│   │   │                                  shimmer skeletons, household cards
│   │   │                                  source: caci_members_module.html
│   │   │
│   │   ├── dashboard.css               ← widget grid, widget card, KPI tiles
│   │   │                                  source: caci_dashboard_module.html
│   │   │
│   │   ├── components.css              ← Modal, ConfirmDialog, Avatar, StatusBadge,
│   │   │                                  EmptyState, OfflineBanner, Notyf overrides
│   │   │
│   │   └── utilities.css              ← text-caci-gold, bg-surface, shimmer keyframes,
│   │                                      scrollbar-hide, skeleton pulse animation
│   │
│   │
│   ├── core/
│   │   │
│   │   ├── supabase.ts                 ← createClient singleton
│   │   │                                  typed: SupabaseClient<Database>
│   │   │                                  same URL + anon key as Flutter .env
│   │   │
│   │   ├── registry.ts                 ← registerModule(), getRoutes(),
│   │   │                                  getSidebarItems(), getWidgets(),
│   │   │                                  getCapabilities(), initModules()
│   │   │
│   │   ├── router.ts                   ← hash-based SPA router
│   │   │                                  reads routes from registry manifests
│   │   │                                  PAGE RENDERING CONTRACT:
│   │   │                                    on navigate in  → page.render(contentArea)
│   │   │                                    on navigate out → page.destroy?.()
│   │   │                                  runs middleware pipeline per route
│   │   │                                  passes route params to render() via dataset
│   │   │                                  mirrors: GoRouter config
│   │   │
│   │   ├── auth.ts                     ← loadCurrentUser(), getCurrentUser(),
│   │   │                                  isAuthenticated(), onAuthStateChange()
│   │   │                                  queries user_profiles after Supabase Auth confirms
│   │   │                                  mirrors: auth_provider.dart
│   │   │
│   │   ├── permissions.ts              ← rolePermissions map, hasPermission(role, perm)
│   │   │                                  mirrors: CACI_Hub_Phase1_Roles_Permissions_Matrix.md
│   │   │
│   │   ├── events.ts                   ← emit(), on(), off() typed event bus
│   │   │
│   │   ├── middleware.ts               ← composeMiddleware(), guardMap registry
│   │   │
│   │   └── guards/
│   │       ├── authGuard.ts            ← unauthenticated → /login
│   │       ├── permissionGuard.ts      ← insufficient role → /unauthorized
│   │       └── onboardingGuard.ts      ← TOTP not enrolled → /totp-enroll
│   │
│   │
│   ├── shell/
│   │   ├── Shell.ts                    ← renders toolbar + sidebar + #page-content
│   │   ├── Sidebar.ts                  ← reads getSidebarItems(), filters by permission,
│   │   │                                  highlights active route, collapsible on mobile
│   │   ├── Toolbar.ts                  ← assembly name, avatar dropdown, logout,
│   │   │                                  notification bell, mobile menu toggle
│   │   ├── Breadcrumbs.ts              ← route-driven
│   │   └── NotificationBell.ts         ← Supabase Realtime listener
│   │
│   │
│   ├── shared/
│   │   │
│   │   ├── utils/
│   │   │   │
│   │   │   ├── pageHelpers.ts          ← THE LOADING/ERROR STATE CONTRACT
│   │   │   │                              Every page render() must use these functions.
│   │   │   │                              No page may inline its own skeleton or error HTML.
│   │   │   │
│   │   │   │                              renderSkeleton(container, variant?)
│   │   │   │                                variant: 'table' | 'card' | 'form' | 'profile'
│   │   │   │                                → replaces container.innerHTML immediately
│   │   │   │                                → shows animated shimmer rows/cards
│   │   │   │                                → mirrors: member_list_shimmer.dart
│   │   │   │
│   │   │   │                              renderEmpty(container, options)
│   │   │   │                                options: { icon, title, message, action? }
│   │   │   │                                → shows EmptyState component
│   │   │   │                                → action renders a button if provided
│   │   │   │                                → mirrors: EmptyState widget
│   │   │   │
│   │   │   │                              renderError(container, error, options?)
│   │   │   │                                error: RepositoryError | unknown
│   │   │   │                                options: { retry?: () => void }
│   │   │   │                                → shows error message + optional retry button
│   │   │   │                                → maps RepositoryError.code to friendly message
│   │   │   │                                   42501 → 'You don't have permission'
│   │   │   │                                   PGRST116 → 'Record not found'
│   │   │   │                                   default → 'Something went wrong'
│   │   │   │
│   │   │   │                              PAGE LIFECYCLE — every page follows this exact shape:
│   │   │   │
│   │   │   │                              async render(container) {
│   │   │   │                                // 1. skeleton — immediate, before any await
│   │   │   │                                renderSkeleton(container, 'table')
│   │   │   │
│   │   │   │                                try {
│   │   │   │                                  // 2. fetch
│   │   │   │                                  const data = await repo.getAll(filter)
│   │   │   │
│   │   │   │                                  // 3a. empty state
│   │   │   │                                  if (!data.length) {
│   │   │   │                                    renderEmpty(container, {
│   │   │   │                                      icon: 'people',
│   │   │   │                                      title: 'No members found',
│   │   │   │                                      message: 'Try adjusting your filters',
│   │   │   │                                      action: { label: 'Clear filters',
│   │   │   │                                               onClick: clearFilters }
│   │   │   │                                    })
│   │   │   │                                    return
│   │   │   │                                  }
│   │   │   │
│   │   │   │                                  // 3b. content
│   │   │   │                                  container.innerHTML = buildTable(data)
│   │   │   │                                  bindEvents(container)
│   │   │   │
│   │   │   │                                } catch (err) {
│   │   │   │                                  // 3c. error state
│   │   │   │                                  renderError(container, err, {
│   │   │   │                                    retry: () => this.render(container)
│   │   │   │                                  })
│   │   │   │                                }
│   │   │   │                              }
│   │   │   │
│   │   │   │                              destroy() {
│   │   │   │                                // cleanup: AG Grid instance, Quill editor,
│   │   │   │                                // event listeners, timers
│   │   │   │                                // called by router before navigating away
│   │   │   │                              }
│   │   │   │
│   │   │   ├── memberCache.ts          ← Member summary cache (read-only for consumers)
│   │   │   │                              Fields: id, full_name, membership_number,
│   │   │   │                                      avatar_url, status, assembly_id
│   │   │   │                              Populated: lazily on first request, or bulk by id[]
│   │   │   │                              Invalidated by: member:updated, member:deleted,
│   │   │   │                                              member:restored (event bus)
│   │   │   │                              Cleared on: auth:signedOut, assembly switch
│   │   │   │                              Used by: finance, events, comms, attendance,
│   │   │   │                                       dashboard, groups
│   │   │   │                              Exports: getMemberSummary(id),
│   │   │   │                                       getMemberSummaries(ids[]),
│   │   │   │                                       invalidateMember(id),
│   │   │   │                                       clearMemberCache()
│   │   │   │
│   │   │   ├── groupCache.ts           ← Group summary cache (read-only for consumers)
│   │   │   │                              Fields: id, name, type, member_count,
│   │   │   │                                      leader_id, assembly_id
│   │   │   │                              Populated: lazily on first request, or bulk by id[]
│   │   │   │                              Invalidated by: group:updated, group:created,
│   │   │   │                                              group:deleted (event bus)
│   │   │   │                              Cleared on: auth:signedOut, assembly switch
│   │   │   │                              Used by: attendance, comms, events, dashboard,
│   │   │   │                                       finance
│   │   │   │                              Exports: getGroupSummary(id),
│   │   │   │                                       getGroupSummaries(ids[]),
│   │   │   │                                       invalidateGroup(id),
│   │   │   │                                       clearGroupCache()
│   │   │   │
│   │   │   ├── format.ts               ← formatDate(), formatName(), formatPhone(),
│   │   │   │                              formatCurrency(), formatMembershipNumber()
│   │   │   │
│   │   │   └── storage.ts              ← localStorage get/set/clear helpers
│   │   │                                  (validate.ts removed — Zod handles validation
│   │   │                                   per module in schemas/ folders)
│   │   │
│   │   └── components/
│   │       ├── Modal.ts                ← Bootstrap modal wrapper
│   │       ├── ConfirmDialog.ts        ← "Are you sure?" modal
│   │       │                              mirrors: remove_member_dialog.dart
│   │       ├── Avatar.ts               ← photo or initials fallback
│   │       │                              mirrors: member_avatar.dart
│   │       ├── StatusBadge.ts          ← active/inactive/visitor/flagged
│   │       │                              mirrors: member_status_badge.dart
│   │       ├── Grid.ts                 ← AG Grid Community wrapper
│   │       │                              (replaces Table.ts / DataTables)
│   │       │                              typed: GridWrapper<T>
│   │       ├── Toast.ts                ← Notyf wrapper: toast.success(), toast.error(),
│   │       │                              toast.warning(), toast.info()
│   │       │                              (replaces raw Toastify usage)
│   │       ├── Form.ts                 ← field builder, Zod error display helpers
│   │       │                              displayZodErrors(form, zodError)
│   │       └── EmptyState.ts           ← icon + message; used by renderEmpty()
│   │
│   │
│   └── modules/
│       │
│       ├── auth/
│       │   ├── index.ts                ← manifest (ModuleManifest)
│       │   │                              enabled: true, no sidebar entry
│       │   ├── routes.ts
│       │   ├── services/
│       │   │   └── authService.ts      ← signIn(), signOut(), resetPassword(),
│       │   │                              verifyTotp(), enrollTotp(), getSession()
│       │   └── pages/
│       │       ├── Login.ts            ← PAGE LIFECYCLE: no skeleton (auth page)
│       │       │                          submit → loading spinner on button
│       │       │                          error → inline alert, not renderError()
│       │       │                          mirrors: sign_in_screen.dart
│       │       ├── ForgotPassword.ts
│       │       ├── ResetPassword.ts
│       │       └── Totp.ts             ← digit-by-digit 6-box OTP input
│       │                                  enroll mode: QR code → verify
│       │
│       ├── dashboard/
│       │   ├── index.ts                ← manifest
│       │   │                              sidebar: Dashboard, order: 1
│       │   ├── routes.ts
│       │   └── pages/
│       │       └── Dashboard.ts        ← PAGE LIFECYCLE:
│       │                                  skeleton: 'card' variant (widget placeholders)
│       │                                  renders widgets via getWidgets() — no hardcoding
│       │
│       ├── membership/
│       │   ├── index.ts                ← manifest
│       │   │                              sidebar: Members, order: 2,
│       │   │                              permission: 'membership.view'
│       │   ├── routes.ts               ← /members, /members/add, /members/:id,
│       │   │                              /members/:id/edit, /members/:id/flag,
│       │   │                              /members/:id/pastoral-notes,
│       │   │                              /members/groups, /members/groups/create,
│       │   │                              /members/households,
│       │   │                              /members/households/create,
│       │   │                              /members/households/:id,
│       │   │                              /members/households/:id/edit,
│       │   │                              /members/attendance, /members/attendance/record,
│       │   │                              /members/reports, /members/reports/:id,
│       │   │                              /members/audit-log, /profile
│       │   │
│       │   ├── schemas/
│       │   │   ├── member.schema.ts    ← CreateMemberSchema, UpdateMemberSchema
│       │   │   │                          infers CreateMemberPayload, UpdateMemberPayload
│       │   │   │                          mirrors: create_member_request.dart validation
│       │   │   ├── filter.schema.ts    ← MemberFilterSchema, HouseholdFilterSchema
│       │   │   │                          mirrors: member_filter.dart, household_filter.dart
│       │   │   └── household.schema.ts ← NEW — CreateHouseholdSchema, UpdateHouseholdSchema
│       │   │                              infers CreateHouseholdPayload, UpdateHouseholdPayload
│       │   │                              mirrors: create_household_screen.dart validation
│       │   │
│       │   ├── repository.ts           ← all Supabase queries
│       │   │                              READ  → members_view (migration 16)
│       │   │                              WRITE → members table directly
│       │   │                              IMPORTANT: assembly_id is enforced by RLS
│       │   │                              automatically for all roles except super_admin.
│       │   │                              super_admin must pass assembly_id explicitly
│       │   │                              in filter — RLS alone will not scope their queries.
│       │   │                              No assembly_id column needed in migrations —
│       │   │                              already present from Flutter schema.
│       │   │                              MEMBER methods:
│       │   │                                getAll(filter), getById(id),
│       │   │                                insert(payload), update(id, payload),
│       │   │                                softDelete(id, reason), restore(id),
│       │   │                                flag(id, reason), getAuditLog(memberId),
│       │   │                                getStats(), uploadPhoto(memberId, file),
│       │   │                                getAttendanceHistory(memberId)
│       │   │                              HOUSEHOLD methods (NEW):
│       │   │                                getHouseholds(filter?), getHouseholdById(id),
│       │   │                                getHouseholdMembers(householdId),
│       │   │                                createHousehold(payload),
│       │   │                                updateHousehold(id, payload),
│       │   │                                deleteHousehold(id),
│       │   │                                setPrimaryContact(householdId, memberId)
│       │   │                              mirrors: households_repository.dart,
│       │   │                                       supabase_member_data_source.dart
│       │   │
│       │   ├── services/
│       │   │   └── memberService.ts    ← orchestrates repository + Edge Functions
│       │   │                              registerMember() → create-member-user EF
│       │   │                                              → send-welcome-email EF
│       │   │                                              → send-welcome-sms EF
│       │   │                              exportCsv()      → export-members-csv EF
│       │   │
│       │   ├── widgets/
│       │   │   ├── NewMembersWidget.ts ← PAGE LIFECYCLE: skeleton 'card', then list
│       │   │   └── MemberStatsWidget.ts← PAGE LIFECYCLE: skeleton 'card', then KPI tiles
│       │   │
│       │   └── pages/
│       │       │
│       │       ├── MemberList.ts       ← PAGE LIFECYCLE: skeleton 'table'
│       │       │                          AG Grid with server-side filter params
│       │       │                          search bar, status/gender/household filters
│       │       │                          CSV export via exportCsv() Edge Function
│       │       │                          destroy() → grid.destroy()
│       │       │                          mirrors: member_list_screen.dart
│       │       │
│       │       ├── MemberProfile.ts    ← PAGE LIFECYCLE: skeleton 'profile'
│       │       │                          tabbed: Details | Pastoral Notes | Audit Log
│       │       │                          action buttons gated by hasPermission()
│       │       │                          mirrors: member_detail_screen.dart
│       │       │
│       │       ├── AddMember.ts        ← PAGE LIFECYCLE: no skeleton (empty form)
│       │       │                          Zod schema validation on submit
│       │       │                          submit button shows spinner during EF calls
│       │       │                          → success: navigate to AddMemberSuccess
│       │       │                          mirrors: add_member_screen.dart
│       │       │
│       │       ├── AddMemberSuccess.ts ← shows membership number
│       │       │                          "Add Another" / "View Member" actions
│       │       │
│       │       ├── EditMember.ts       ← PAGE LIFECYCLE: skeleton 'form'
│       │       │                          pre-populate from getById(), then show form
│       │       │                          Zod schema validation on submit
│       │       │                          mirrors: edit_member_screen.dart
│       │       │
│       │       ├── FlagMember.ts       ← flag reason form + ConfirmDialog
│       │       │
│       │       ├── EditPastoralNotes.ts← PAGE LIFECYCLE: skeleton 'form'
│       │       │                          Quill editor init in bindEvents()
│       │       │                          destroy() → quill instance cleanup
│       │       │                          pastor role only (permissionGuard)
│       │       │
│       │       ├── AuditLog.ts         ← PAGE LIFECYCLE: skeleton 'table'
│       │       │                          mirrors: audit_log_screen.dart
│       │       │
│       │       ├── Reports.ts          ← PAGE LIFECYCLE: skeleton 'card'
│       │       ├── ReportDetail.ts     ← Chart.js charts; destroy() → chart.destroy()
│       │       │
│       │       ├── Groups.ts           ← PAGE LIFECYCLE: skeleton 'table'
│       │       ├── GroupCreate.ts      ← Zod schema validation
│       │       │
│       │       ├── HouseholdList.ts    ← NEW — PAGE LIFECYCLE: skeleton 'table'
│       │       │                          AG Grid; name, address, member count, primary contact
│       │       │                          search + filter drawer
│       │       │                          "Create household" action button
│       │       │                          destroy() → grid.destroy()
│       │       │                          mirrors: households_screen.dart
│       │       │
│       │       ├── HouseholdDetail.ts  ← NEW — PAGE LIFECYCLE: skeleton 'profile'
│       │       │                          household name, address, primary contact card
│       │       │                          member list: AG Grid of household members
│       │       │                          action buttons: Edit, Delete (admin only)
│       │       │                          Set Primary Contact action (admin/pastor)
│       │       │                          destroy() → grid.destroy()
│       │       │                          mirrors: household_screen.dart
│       │       │
│       │       ├── HouseholdCreate.ts  ← NEW — PAGE LIFECYCLE: no skeleton (empty form)
│       │       │                          fields: name, address, primary_contact_id
│       │       │                          primary_contact_id → member search dropdown
│       │       │                          Zod schema validation on submit
│       │       │                          → success: navigate to HouseholdDetail
│       │       │                          mirrors: create_household_screen.dart
│       │       │
│       │       ├── HouseholdEdit.ts    ← NEW — PAGE LIFECYCLE: skeleton 'form'
│       │       │                          pre-populate from getHouseholdById(), then form
│       │       │                          Zod schema validation on submit
│       │       │                          mirrors: edit_household_screen.dart
│       │       │
│       │       ├── Attendance.ts       ← PAGE LIFECYCLE: skeleton 'table'
│       │       ├── RecordAttendance.ts ← mark attendance form
│       │       ├── PastoralCare.ts     ← pastor role only; skeleton 'table'
│       │       └── MyProfile.ts        ← PAGE LIFECYCLE: skeleton 'profile'
│       │                                  read-only except avatar + password
│       │
│       ├── finance/
│       │   ├── index.ts                ← enabled: false
│       │   └── routes.ts
│       │
│       ├── events/
│       │   ├── index.ts                ← enabled: false
│       │   └── routes.ts
│       │
│       ├── comms/
│       │   ├── index.ts                ← enabled: false
│       │   └── routes.ts
│       │
│       ├── admin/                      ← NEW — enabled: false (Phase 2)
│       │   ├── index.ts                ← manifest
│       │   │                              enabled: false
│       │   │                              sidebar: Admin, order: 98, icon: 'shield-lock'
│       │   │                              permission: 'admin.access'
│       │   │                              NOTE: stub only — no init(), no routes active.
│       │   │                              Flip enabled: true in Phase 2 to activate.
│       │   │                              mirrors: Flutter lib/features/admin/
│       │   ├── routes.ts               ← /admin/users
│       │   │                              /admin/users/:memberId/provision
│       │   │                              /admin/audit-log
│       │   │                              all guarded: middleware: ['auth', 'permissions']
│       │   │                              permission: 'admin.access'
│       │   └── pages/                  ← stub files — export default { render, destroy }
│       │       │                          each throws or shows "coming soon" until Phase 2
│       │       ├── UserManagement.ts   ← mirrors: user_management_screen.dart
│       │       │                          list of auth users, role assignment,
│       │       │                          link member ↔ auth user
│       │       ├── ProvisionUser.ts    ← mirrors: add_user_for_member_screen.dart
│       │       │                          create Supabase auth account for an existing member
│       │       │                          calls create-member-user Edge Function
│       │       └── GlobalAuditLog.ts   ← mirrors: global_audit_log_screen.dart
│       │                                  cross-member audit log for admin/super_admin
│       │                                  PAGE LIFECYCLE: skeleton 'table' (when enabled)
│       │
│       └── settings/
│           ├── index.ts                ← sidebar: Settings, order: 99
│           ├── routes.ts
│           └── pages/
│               └── Settings.ts         ← account settings, password change,
│                                          TOTP management, theme toggle
│
│
└── supabase/                           ← UNTOUCHED
    ├── config.toml
    ├── seed.sql
    ├── migrations/                     ← all 40 Flutter migrations — do not touch
    │   └── *.sql                          assembly_id already present in schema
    │                                      latest: 20260516000000_grant_anon_user_profile_select.sql
    └── functions/
        ├── create-member-user/
        ├── export-members-csv/
        ├── generate-membership-number/
        ├── send-welcome-email/
        └── send-welcome-sms/
