# Graph Report - .  (2026-07-21)

## Corpus Check
- 243 files · ~128,522 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2269 nodes · 3774 edges · 261 communities (116 shown, 145 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.65)
- Token cost: 24,295 input · 1,129 output

## Community Hubs (Navigation)
- API Client Mutations
- API Request/Response Types
- Checklist Settings UI
- Shadcn UI: Kbd/Sheet/Resizable
- API Schema Types
- Admin Role Management UI
- Shadcn UI: Accordion/Alert/Avatar
- Onboarding & Account Creation UI
- Org Unit Tree Selector
- Checklist Zod Schemas
- App Layout, Login & Profile
- Docx Import & Auth Guards
- Checklist Context & Sync
- Mobile Package Dependencies
- Tenant Scoping & Auth Middleware
- Expo App Config
- Drizzle DB Dependencies
- Auth Tokens & WebAuthn
- Custom Fetch Client
- Web Build Script
- Org Units API Router
- Passkey Challenges & Onboarding Context
- Shadcn Field Components
- Shadcn Toast Components
- API Server Bootstrap
- Shifts & Checklist DB Schema
- Static Server (serve.js)
- Shadcn Alert Dialog/Button
- TypeScript Config (app)
- TypeScript Config (workspace)
- Admin
- Localcheckliststore
- Package
- Reports
- Authcontext
- Checklistcontext
- Button Group
- Package
- Package
- Exportmodal
- Components
- Command
- Menubar
- Dashutils
- Package
- Pdf Import
- Carousel
- Tsconfig
- Checklists
- Tsconfig
- App
- Input
- Tsconfig
- Package
- Import Checklist
- Reports
- Trendcard
- Errorboundary
- Package
- Authresult
- Tsconfig
- Breakdowncard
- Dashutils
- Package
- Chart
- Tsconfig
- Package
- Checklist Settings
- Package
- Context Menu
- Dropdown Menu
- Railway
- Tsconfig
- Table
- Package
- Package
- Breadcrumb
- Drawer
- Empty
- Navigation Menu
- Select
- Checklistimportresult
- Createrolerequest
- Checklistcontext
- Card
- Toggle
- Jsonobject
- Registerrequest
- Tsconfig
- Passkey Native
- Mockuppreviewplugin
- Api
- Api
- Api
- Orval Config
- Badge
- Claude
- Api
- Api
- Api
- Api
- Api
- Checklisttask
- Onboardingcompleterequest
- Onboardingcompleteresponse
- Shifttaskcompletion
- Build
- Icon
- Keyboardawarescrollviewcompat
- Sonner
- Checklist 1778177718316
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Metro Config
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Package
- Handoff Railway Deploy
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Api
- Docxupload
- Healthstatus
- Updatemerequest
- Drizzle Config
- Post Merge
- Webauthn
- Logo
- 6Cea8C30 6D12 4B0A Aa38 698303809856 177
- End Shift — Design System
- Pnpm Workspace
- Security

## God Nodes (most connected - your core abstractions)
1. `cn()` - 138 edges
2. `useColors()` - 87 edges
3. `customFetch()` - 58 edges
4. `ChecklistProvider()` - 39 edges
5. `describeApiError()` - 33 edges
6. `Alert` - 27 edges
7. `useAuth()` - 26 edges
8. `useChecklist()` - 26 edges
9. `compilerOptions` - 22 edges
10. `expo-router` - 18 edges

## Surprising Connections (you probably didn't know these)
- `RoleRestrictCard()` --calls--> `listRoles()`  [EXTRACTED]
  artifacts/checklist/app/checklist-settings.tsx → lib/api-client-react/src/generated/api.ts
- `TreeDistrict` --references--> `OrgUnit`  [EXTRACTED]
  artifacts/checklist/components/admin/OrgUnitSelector.tsx → lib/api-client-react/src/generated/api.schemas.ts
- `TreeRegion` --references--> `OrgUnit`  [EXTRACTED]
  artifacts/checklist/components/admin/OrgUnitSelector.tsx → lib/api-client-react/src/generated/api.schemas.ts
- `OrgUnitSelectorProps` --references--> `OrgUnit`  [EXTRACTED]
  artifacts/checklist/components/admin/OrgUnitSelector.tsx → lib/api-client-react/src/generated/api.schemas.ts
- `TreeDistrict` --references--> `OrgUnit`  [EXTRACTED]
  artifacts/checklist/components/admin/OrgUnitTree.tsx → lib/api-client-react/src/generated/api.schemas.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **API Contract Generation** — lib_api_spec_openapi, lib_api_zod, claude [EXTRACTED 1.00]

## Communities (261 total, 145 thin omitted)

### Community 0 - "API Client Mutations"
Cohesion: 0.02
Nodes (125): Awaited, AwaitedInput, CompleteOnboardingMutationBody, CompleteOnboardingMutationError, CompleteOnboardingMutationResult, CompleteShiftTaskMutationError, CompleteShiftTaskMutationResult, CreateChecklistMutationBody (+117 more)

### Community 1 - "API Request/Response Types"
Cohesion: 0.03
Nodes (75): CompleteOnboardingBody, CompleteOnboardingResponse, CompleteShiftTaskParams, CreateChecklistBody, CreateChecklistTaskBody, CreateChecklistTaskParams, CreateOrgUnitBody, createProfileBodyPasswordRegExp (+67 more)

### Community 2 - "Checklist Settings UI"
Cohesion: 0.07
Nodes (47): ChecklistSettingsScreen(), DragHandle(), EditModal(), EditTarget, SectionCard(), styles, TaskSettingsRow(), ExportSettingsScreen() (+39 more)

### Community 3 - "Shadcn UI: Kbd/Sheet/Resizable"
Cohesion: 0.07
Nodes (44): Kbd(), KbdGroup(), ResizableHandle(), ResizablePanelGroup(), SheetContent, SheetContentProps, SheetDescription, SheetFooter() (+36 more)

### Community 4 - "API Schema Types"
Cohesion: 0.05
Nodes (40): AuthResult, ChecklistImportResult, ChecklistInput, ChecklistRoles, ChecklistRolesUpdate, ChecklistTaskInput, ChecklistTaskUpdate, ChecklistUpdate (+32 more)

### Community 5 - "Admin Role Management UI"
Cohesion: 0.09
Nodes (35): AdminScreen(), Field(), RIGHT_VALUES, RoleEditModal(), styles, AdminWebScreen(), s, Tab (+27 more)

### Community 6 - "Shadcn UI: Accordion/Alert/Avatar"
Cohesion: 0.05
Nodes (26): AccordionContent, AccordionItem, AccordionTrigger, AlertDescription, AlertTitle, alertVariants, Avatar, AvatarFallback (+18 more)

### Community 7 - "Onboarding & Account Creation UI"
Cohesion: 0.09
Nodes (32): CreateAccountScreen(), styles, toAppTitle(), OnboardingScreen(), ROLE_OPTIONS, sh, Step, StepAccountType() (+24 more)

### Community 8 - "Org Unit Tree Selector"
Cohesion: 0.08
Nodes (34): buildTree(), getSubtreeIds(), OrgUnitSelector(), OrgUnitSelectorProps, s, TreeDistrict, TreeRegion, buildTree() (+26 more)

### Community 9 - "Checklist Zod Schemas"
Cohesion: 0.05
Nodes (19): Checklist, ChecklistInput, ChecklistRoles, ChecklistRolesUpdate, ChecklistTaskInput, ChecklistTaskUpdate, ChecklistUpdate, CreateProfileRequest (+11 more)

### Community 10 - "App Layout, Login & Profile"
Cohesion: 0.08
Nodes (31): queryClient, RootLayoutNav(), LoginScreen(), showAlert(), styles, EditField, ExpandSection, getInitials() (+23 more)

### Community 11 - "Docx Import & Auth Guards"
Cohesion: 0.08
Nodes (27): blockIfMustChangePassword(), requireAnyRight(), requireRight(), router, ImportSection, ImportTask, isRequired(), parseDocxHtml() (+19 more)

### Community 12 - "Checklist Context & Sync"
Cohesion: 0.11
Nodes (35): ChecklistProvider(), DEFAULT_APP_CONFIG, deriveSections(), shiftToCompleted(), toChecklistMeta(), toTask(), localListShifts(), customFetch() (+27 more)

### Community 13 - "Mobile Package Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, docx, expo-clipboard, expo-document-picker, expo-print, expo-secure-store, expo-sharing, react (+27 more)

### Community 14 - "Tenant Scoping & Auth Middleware"
Cohesion: 0.10
Nodes (23): orgUnitSubtreeIds(), visibleOrgUnitIds(), AuthedUser, Express, extractToken(), Request, requireAuth(), OnboardingCompleteBody (+15 more)

### Community 15 - "Expo App Config"
Cohesion: 0.06
Nodes (32): package, projectId, reactCompiler, typedRoutes, expo, android, experiments, extra (+24 more)

### Community 16 - "Drizzle DB Dependencies"
Cohesion: 0.06
Nodes (30): drizzle-kit, drizzle-zod, dependencies, drizzle-orm, drizzle-zod, pg, zod, devDependencies (+22 more)

### Community 17 - "Auth Tokens & WebAuthn"
Cohesion: 0.10
Nodes (25): AccessTokenPayload, getSecret(), RefreshTokenPayload, signAccessToken(), signRefreshToken(), verifyAccessToken(), verifyPassword(), verifyRefreshToken() (+17 more)

### Community 18 - "Custom Fetch Client"
Cohesion: 0.11
Nodes (27): applyBaseUrl(), AuthRefreshHandler, AuthTokenGetter, BodyType, buildErrorMessage(), CustomFetchOptions, ErrorType, getMediaType() (+19 more)

### Community 19 - "Web Build Script"
Cohesion: 0.12
Nodes (27): basePath, buildWebSpa(), checkMetroHealth(), clearMetroCache(), downloadAssets(), downloadBundle(), downloadBundlesAndManifests(), downloadFile() (+19 more)

### Community 20 - "Org Units API Router"
Cohesion: 0.08
Nodes (25): CreateOrgUnitBody, router, UpdateOrgUnitBody, AccountType, accountTypeEnum, InsertOrgUnit, InsertPasskeyCredential, InsertRefreshToken (+17 more)

### Community 21 - "Passkey Challenges & Onboarding Context"
Cohesion: 0.11
Nodes (24): consumeChallenge(), Entry, rememberChallenge(), store, sweep(), DEFAULT_SETTINGS, DEFAULT_STATE, District (+16 more)

### Community 22 - "Shadcn Field Components"
Cohesion: 0.08
Nodes (22): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+14 more)

### Community 23 - "Shadcn Toast Components"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 24 - "API Server Bootstrap"
Cohesion: 0.15
Nodes (18): app, port, runMigrations(), start(), verifySchema(), hashPassword(), logger, KNOWN_WEAK_PASSWORDS (+10 more)

### Community 25 - "Shifts & Checklist DB Schema"
Cohesion: 0.10
Nodes (23): shapeCompletion(), shapeShift(), shapeShiftWithCompletions(), SubmitBody, tenantsTable, Checklist, ChecklistRole, checklistRolesRelations (+15 more)

### Community 26 - "Static Server (serve.js)"
Cohesion: 0.08
Nodes (17): appName, basePath, crypto, fs, http, landingPageTemplate, MIME_TYPES, path (+9 more)

### Community 27 - "Shadcn Alert Dialog/Button"
Cohesion: 0.11
Nodes (21): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+13 more)

### Community 28 - "TypeScript Config (app)"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, noEmit, paths, types (+16 more)

### Community 29 - "TypeScript Config (workspace)"
Cohesion: 0.08
Nodes (24): workspace, compilerOptions, alwaysStrict, customConditions, isolatedModules, lib, module, moduleResolution (+16 more)

### Community 30 - "Admin"
Cohesion: 0.13
Nodes (22): generateTempPassword(), ProfileEditModal(), AssignUserModal(), Avatar(), AVATAR_PALETTE, avatarColor(), FormField(), generateTempPassword() (+14 more)

### Community 31 - "Localcheckliststore"
Cohesion: 0.21
Nodes (22): _idCounter, localCompleteShiftTask(), localCreateChecklist(), localCreateChecklistTask(), localDeleteChecklist(), localDeleteChecklistTask(), localGetChecklist(), localGetShift() (+14 more)

### Community 32 - "Package"
Cohesion: 0.09
Nodes (23): devDependencies, esbuild, esbuild-plugin-pino, pino-pretty, thread-stream, @types/cookie-parser, @types/cors, @types/express (+15 more)

### Community 33 - "Reports"
Cohesion: 0.24
Nodes (19): ReportsScreen(), addDays(), buildBuckets(), computeMissedSteps(), counts(), daysBetween(), DOW_SHORT, endOfDay() (+11 more)

### Community 34 - "Authcontext"
Cohesion: 0.18
Nodes (18): AuthContext, AuthContextValue, AuthProvider(), configureApiBaseUrl(), storageDel(), storageGet(), storageSet(), ApiError (+10 more)

### Community 35 - "Checklistcontext"
Cohesion: 0.14
Nodes (6): ChecklistContextValue, ChecklistCache, StorageMode, Checklist, ChecklistWithTasks, ShiftWithCompletions

### Community 36 - "Button Group"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 37 - "Package"
Cohesion: 0.11
Nodes (19): dependencies, bcryptjs, cookie-parser, drizzle-orm, express, pdf-parse, @simplewebauthn/server, @workspace/api-zod (+11 more)

### Community 38 - "Package"
Cohesion: 0.11
Nodes (19): devDependencies, class-variance-authority, clsx, input-otp, @radix-ui/react-avatar, @radix-ui/react-label, @radix-ui/react-navigation-menu, @radix-ui/react-popover (+11 more)

### Community 39 - "Exportmodal"
Cohesion: 0.21
Nodes (16): FormatPill(), Props, styles, Task, buildCsv(), buildDocxBlob(), buildHeaderCell(), buildPdfHtml() (+8 more)

### Community 40 - "Components"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 41 - "Command"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 42 - "Menubar"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 43 - "Dashutils"
Cohesion: 0.17
Nodes (13): deltaPct(), DonutChart(), DonutChartProps, KpiCard(), KpiCardProps, RING_COLORS, styles, DateWindow (+5 more)

### Community 44 - "Package"
Cohesion: 0.12
Nodes (15): devDependencies, prettier, typescript, typescript, license, name, packageManager, private (+7 more)

### Community 45 - "Pdf Import"
Cohesion: 0.21
Nodes (12): cleanSectionTitle(), cleanSubsectionTitle(), execFileAsync, isSectionHeader(), isSubsectionMarker(), isUsableLine(), parsePdfText(), PdfSection (+4 more)

### Community 46 - "Carousel"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 47 - "Tsconfig"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, declarationMap, emitDeclarationOnly, lib, outDir, rootDir, extends (+5 more)

### Community 48 - "Checklists"
Cohesion: 0.17
Nodes (9): CHECKLIST_ADMIN_RIGHTS, CreateBody, hasChecklistAdminRight(), RolesUpdateBody, router, TaskCreateBody, TaskUpdateBody, UpdateBody (+1 more)

### Community 49 - "Tsconfig"
Cohesion: 0.15
Nodes (12): compilerOptions, baseUrl, paths, strict, extends, include, references, expo-env.d.ts (+4 more)

### Community 50 - "App"
Cohesion: 0.22
Nodes (8): App(), Gallery(), getBasePath(), getPreviewExamplePath(), getPreviewPath(), ModuleMap, ModuleMap, modules

### Community 51 - "Input"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 52 - "Tsconfig"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, types, extends (+4 more)

### Community 53 - "Package"
Cohesion: 0.15
Nodes (12): devDependencies, tsx, @types/node, tsx, @types/node, name, private, scripts (+4 more)

### Community 54 - "Import Checklist"
Cohesion: 0.20
Nodes (10): getTemplateUrl(), IMPORT_CONFIG, ImportChecklistScreen(), ImportType, makeStyles(), ReviewSection, ReviewTask, Stage (+2 more)

### Community 55 - "Reports"
Cohesion: 0.20
Nodes (9): HISTORY_FILTERS, HistoryFilter, PERIOD_META, styles, shiftWindow(), MissedStepsCard(), MissedStepsCardProps, styles (+1 more)

### Community 56 - "Trendcard"
Cohesion: 0.27
Nodes (9): LEGEND, styles, TrendCardProps, areaPath(), smoothPath(), STATUS, TrendChart(), TrendChartProps (+1 more)

### Community 57 - "Errorboundary"
Cohesion: 0.21
Nodes (6): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, ErrorFallback(), ErrorFallbackProps, styles

### Community 58 - "Package"
Cohesion: 0.17
Nodes (11): dependencies, @tanstack/react-query, exports, react, @tanstack/react-query, name, peerDependencies, react (+3 more)

### Community 59 - "Authresult"
Cohesion: 0.32
Nodes (6): AuthResult, CreateOrgUnitRequest, OrgUnit, OrgUnitType, Profile, ProfileAccountType

### Community 60 - "Tsconfig"
Cohesion: 0.18
Nodes (10): compilerOptions, outDir, rootDir, types, extends, include, node, src (+2 more)

### Community 61 - "Breakdowncard"
Cohesion: 0.24
Nodes (9): BreakdownCard(), BreakdownCardProps, calcDelta(), LegendRow, styles, MultiDonutChart(), MultiDonutChartProps, Segment (+1 more)

### Community 62 - "Dashutils"
Cohesion: 0.25
Nodes (10): fmtDate(), fmtTime(), timeAgo(), HistoryCard(), HistoryCardProps, OUTCOME_BADGE_STYLE, OUTCOME_BORDER, styles (+2 more)

### Community 63 - "Package"
Cohesion: 0.18
Nodes (11): devDependencies, babel-plugin-react-compiler, expo-blur, @expo/ngrok, expo-router, typescript, typescript, babel-plugin-react-compiler (+3 more)

### Community 64 - "Chart"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 65 - "Tsconfig"
Cohesion: 0.18
Nodes (10): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, extends, include (+2 more)

### Community 66 - "Package"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, start, typecheck, type (+1 more)

### Community 67 - "Checklist Settings"
Cohesion: 0.20
Nodes (10): RoleRestrictCard(), getChecklistRoles(), getGetChecklistRolesQueryKey(), getGetChecklistRolesQueryOptions(), getGetChecklistRolesUrl(), getUpdateChecklistRolesMutationOptions(), getUpdateChecklistRolesUrl(), updateChecklistRoles() (+2 more)

### Community 68 - "Package"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, preview, typecheck, type (+1 more)

### Community 69 - "Context Menu"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 70 - "Dropdown Menu"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 71 - "Railway"
Cohesion: 0.20
Nodes (9): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType (+1 more)

### Community 72 - "Tsconfig"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, types, extends, include, node, src (+1 more)

### Community 73 - "Table"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 74 - "Package"
Cohesion: 0.22
Nodes (8): devDependencies, orval, name, private, scripts, codegen, version, orval

### Community 75 - "Package"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 76 - "Breadcrumb"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 77 - "Drawer"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 78 - "Empty"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 79 - "Navigation Menu"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 80 - "Select"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 81 - "Checklistimportresult"
Cohesion: 0.46
Nodes (4): ChecklistImportResult, PdfImportResult, PdfImportSection, PdfImportTask

### Community 82 - "Createrolerequest"
Cohesion: 0.46
Nodes (4): CreateRoleRequest, Right, Role, UpdateRoleRequest

### Community 83 - "Checklistcontext"
Cohesion: 0.38
Nodes (6): CompletedChecklist, CLOSING_TASKS, generateMockHistory(), makePrng(), SECTIONS, STUBBORN_IDS

### Community 84 - "Card"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 85 - "Toggle"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 86 - "Jsonobject"
Cohesion: 0.60
Nodes (3): JsonObject, PasskeyAuthVerifyRequest, PasskeyRegisterVerifyRequest

### Community 87 - "Registerrequest"
Cohesion: 0.60
Nodes (3): RegisterRequest, RegisterRequestAccountType, RegisterRequestBusinessType

### Community 88 - "Tsconfig"
Cohesion: 0.33
Nodes (5): compileOnSave, extends, files, ./tsconfig.base.json, references

### Community 89 - "Passkey Native"
Cohesion: 0.70
Nodes (4): isPasskeySupported(), loadLib(), nativeAuthenticate(), nativeRegister()

### Community 90 - "Mockuppreviewplugin"
Cohesion: 0.50
Nodes (3): DiscoveredComponent, mockupPreviewPlugin(), port

### Community 91 - "Api"
Cohesion: 0.40
Nodes (5): getGetSpreadsheetTemplateQueryKey(), getGetSpreadsheetTemplateQueryOptions(), getGetSpreadsheetTemplateUrl(), getSpreadsheetTemplate(), useGetSpreadsheetTemplate()

### Community 92 - "Api"
Cohesion: 0.40
Nodes (5): getHealthCheckQueryKey(), getHealthCheckQueryOptions(), getHealthCheckUrl(), healthCheck(), useHealthCheck()

### Community 93 - "Api"
Cohesion: 0.40
Nodes (5): getListChecklistTasksQueryKey(), getListChecklistTasksQueryOptions(), getListChecklistTasksUrl(), listChecklistTasks(), useListChecklistTasks()

### Community 94 - "Orval Config"
Cohesion: 0.40
Nodes (3): apiClientReactSrc, apiZodSrc, root

### Community 95 - "Badge"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 96 - "Claude"
Cohesion: 0.50
Nodes (3): API Specification, Database Schema, Threat Model

### Community 97 - "Api"
Cohesion: 0.50
Nodes (4): getImportChecklistFromDocxMutationOptions(), getImportChecklistFromDocxUrl(), importChecklistFromDocx(), useImportChecklistFromDocx()

### Community 98 - "Api"
Cohesion: 0.50
Nodes (4): getImportChecklistFromPdfMutationOptions(), getImportChecklistFromPdfUrl(), importChecklistFromPdf(), useImportChecklistFromPdf()

### Community 99 - "Api"
Cohesion: 0.50
Nodes (4): getImportChecklistFromSpreadsheetMutationOptions(), getImportChecklistFromSpreadsheetUrl(), importChecklistFromSpreadsheet(), useImportChecklistFromSpreadsheet()

### Community 100 - "Api"
Cohesion: 0.50
Nodes (4): getLoginMutationOptions(), getLoginUrl(), login(), useLogin()

### Community 101 - "Api"
Cohesion: 0.50
Nodes (4): getLogoutMutationOptions(), getLogoutUrl(), logout(), useLogout()

### Community 107 - "Icon"
Cohesion: 0.67
Nodes (3): App Icon, Landing Page Template, Mockup Sandbox Index

### Community 111 - "Api"
Cohesion: 0.67
Nodes (3): getGetChecklistQueryKey(), getGetChecklistQueryOptions(), useGetChecklist()

### Community 112 - "Api"
Cohesion: 0.67
Nodes (3): getGetMeQueryKey(), getGetMeQueryOptions(), useGetMe()

### Community 113 - "Api"
Cohesion: 0.67
Nodes (3): getGetShiftQueryKey(), getGetShiftQueryOptions(), useGetShift()

### Community 114 - "Api"
Cohesion: 0.67
Nodes (3): getListChecklistsQueryKey(), getListChecklistsQueryOptions(), useListChecklists()

### Community 115 - "Api"
Cohesion: 0.67
Nodes (3): getListOrgUnitsQueryKey(), getListOrgUnitsQueryOptions(), useListOrgUnits()

### Community 116 - "Api"
Cohesion: 0.67
Nodes (3): getListProfilePasskeysQueryKey(), getListProfilePasskeysQueryOptions(), useListProfilePasskeys()

### Community 117 - "Api"
Cohesion: 0.67
Nodes (3): getListProfilesQueryKey(), getListProfilesQueryOptions(), useListProfiles()

### Community 118 - "Api"
Cohesion: 0.67
Nodes (3): getListRolesQueryKey(), getListRolesQueryOptions(), useListRoles()

### Community 119 - "Api"
Cohesion: 0.67
Nodes (3): getListShiftsQueryKey(), getListShiftsQueryOptions(), useListShifts()

## Knowledge Gaps
- **947 isolated node(s):** `artifactDir`, `name`, `version`, `private`, `type` (+942 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **145 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Alert` connect `Checklist Settings UI` to `Admin Role Management UI`, `Shadcn UI: Accordion/Alert/Avatar`, `Onboarding & Account Creation UI`, `Org Unit Tree Selector`, `App Layout, Login & Profile`, `Admin`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `cn()` connect `Shadcn UI: Kbd/Sheet/Resizable` to `Shadcn UI: Accordion/Alert/Avatar`, `Shadcn Field Components`, `Shadcn Toast Components`, `Shadcn Alert Dialog/Button`, `Button Group`, `Command`, `Menubar`, `Carousel`, `Input`, `Chart`, `Context Menu`, `Dropdown Menu`, `Table`, `Breadcrumb`, `Drawer`, `Empty`, `Navigation Menu`, `Select`, `Card`, `Toggle`, `Badge`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `parseSpreadsheet()` connect `Docx Import & Auth Guards` to `Passkey Challenges & Onboarding Context`, `Package`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **What connects `artifactDir`, `name`, `version` to the rest of the system?**
  _947 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Client Mutations` be split into smaller, more focused modules?**
  _Cohesion score 0.015873015873015872 - nodes in this community are weakly interconnected._
- **Should `API Request/Response Types` be split into smaller, more focused modules?**
  _Cohesion score 0.02631578947368421 - nodes in this community are weakly interconnected._
- **Should `Checklist Settings UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07272727272727272 - nodes in this community are weakly interconnected._