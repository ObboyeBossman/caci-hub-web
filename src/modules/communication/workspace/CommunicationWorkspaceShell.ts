// src/modules/communication/workspace/CommunicationWorkspaceShell.ts
// Re-exports WorkspaceTab from the shared shell so that communication tabs
// can import from a stable local path that can be extended later.

export type { WorkspaceTab, ShellConfig } from '@shell/WorkspaceShell'
export { WorkspaceShell }                 from '@shell/WorkspaceShell'
