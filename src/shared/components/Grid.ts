// src/shared/components/Grid.ts
// AG Grid Community wrapper — typed, with CACI theme applied.
// Used for all member list, household list, and report tables.
//
// Usage:
//   const grid = new Grid<MemberView>(container, { data, columns })
//   // later:
//   grid.setData(newData)
//   grid.destroy()

import type { GridOptions, ColDef, GridApi } from 'ag-grid-community'
import { createGrid, ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

// Register all community modules once
ModuleRegistry.registerModules([AllCommunityModule])

export interface GridConfig<T> {
  data:      T[]
  columns:   ColDef<T>[]
  onRowClick?: (row: T) => void
  rowHeight?: number
  pagination?: boolean
  pageSize?:   number
}

export class Grid<T = unknown> {
  private _gridApi: GridApi<T> | null = null
  private _container: HTMLElement

  constructor(container: HTMLElement, config: GridConfig<T>) {
    this._container = container
    this._init(config)
  }

  private _init(config: GridConfig<T>): void {
    const options: GridOptions<T> = {
      rowData:         config.data,
      columnDefs:      config.columns,
      rowHeight:       config.rowHeight ?? 48,
      headerHeight:    40,
      suppressMovableColumns: true,
      suppressCellFocus: true,
      defaultColDef: {
        resizable:   true,
        sortable:    true,
        filter:      false,
        cellStyle:   { display: 'flex', alignItems: 'center' },
      },
      pagination:        config.pagination ?? true,
      paginationPageSize: config.pageSize ?? 25,
      paginationPageSizeSelector: [10, 25, 50, 100],
      domLayout:    'normal',
      onRowClicked: config.onRowClick
        ? (e) => { if (e.data) config.onRowClick!(e.data) }
        : undefined,
      // Styling
      rowClass: 'ag-row-caci',
    }

    this._gridApi = createGrid(this._container, options)
    this._applyTheme()
  }

  private _applyTheme(): void {
    // Inject CACI-compatible AG Grid CSS overrides
    if (!document.getElementById('ag-caci-style')) {
      const style = document.createElement('style')
      style.id = 'ag-caci-style'
      style.textContent = `
        .ag-theme-quartz {
          --ag-font-family: var(--font-sans);
          --ag-font-size: 13px;
          --ag-background-color: var(--bg-card);
          --ag-header-background-color: var(--caci-n50);
          --ag-odd-row-background-color: var(--bg-card);
          --ag-row-hover-color: var(--bg-hover);
          --ag-border-color: var(--border-default);
          --ag-header-foreground-color: var(--text-secondary);
          --ag-foreground-color: var(--text-primary);
          --ag-selected-row-background-color: var(--caci-blue-bg);
          --ag-row-border-style: solid;
          --ag-row-border-width: 1px;
          --ag-row-border-color: var(--border-default);
        }
        [data-theme="dark"] .ag-theme-quartz {
          --ag-background-color: var(--bg-card);
          --ag-header-background-color: #21262D;
          --ag-odd-row-background-color: var(--bg-card);
          --ag-row-hover-color: var(--bg-hover);
          --ag-border-color: var(--border-default);
        }
        .ag-paging-panel { font-size: 12px; color: var(--text-secondary); }
        .ag-header-cell-label { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; }
      `
      document.head.appendChild(style)
    }

    this._container.classList.add('ag-theme-quartz')
    this._container.style.height = this._container.style.height || '500px'
  }

  setData(data: T[]): void {
    this._gridApi?.setGridOption('rowData', data)
  }

  setQuickFilter(text: string): void {
    this._gridApi?.setGridOption('quickFilterText', text)
  }

  destroy(): void {
    this._gridApi?.destroy()
    this._gridApi = null
  }
}