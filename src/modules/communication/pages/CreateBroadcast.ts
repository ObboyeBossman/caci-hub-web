// src/modules/communication/pages/CreateBroadcast.ts
import type { PageModule } from '../../../types/module.types';
import { getCurrentUser } from '@core/auth';
import { supabase } from '@core/supabase';
import { renderError } from '@shared/utils/pageHelpers';
import { showToast } from '@shell/Toast';
import { renderBreadcrumbs } from '@shell/Breadcrumbs';
import { can } from '@core/authorization/authorization-service';
import { PERMISSIONS } from '@core/authorization/permissions';
import type { Database } from '../../../types/database.types';

type Attachment = {
  type: 'image' | 'audio' | 'video' | 'document';
  file: File;
  name: string;
  size: string; // e.g. "1.2 MB"
  dataUrl?: string;
  path?: string; // after upload
};

type GroupRow = {
  id: string;
  name: string;
  count: number;
  color: string;
};

type MemberRow = {
  id: string;
  name: string;
  meta: string;
};

// ── CSS (embedded for simplicity; can be extracted to a separate file) ──
const STYLES = `
/* ============================================================
   CREATE BROADCAST PAGE
   ============================================================ */
.broadcast-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 20px 80px;
  font-family: var(--font-sans);
}

.broadcast-page .page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.broadcast-page .page-head h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}
.broadcast-page .page-head p {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin-top: 3px;
}
.broadcast-page .theme-toggle {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.broadcast-page .theme-toggle:hover {
  background: var(--bg-hover);
}

/* Card shell */
.broadcast-page .panel {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-raised);
}

/* ============================================================
   AUDIENCE
   ============================================================ */
.broadcast-page .audience-panel {
  margin-bottom: 16px;
  overflow: hidden;
}
.broadcast-page .audience-head {
  padding: 16px 18px 0 18px;
}
.broadcast-page .audience-head .label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.broadcast-page .audience-head .label i {
  font-size: 15px;
}

.broadcast-page .audience-modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 18px 18px 18px;
}
@media (max-width: 600px) {
  .broadcast-page .audience-modes {
    grid-template-columns: 1fr;
  }
}

.broadcast-page .mode-card {
  position: relative;
  text-align: left;
  border: 1.5px solid var(--border-default);
  background: var(--bg-page);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.14s, background 0.14s, box-shadow 0.14s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.broadcast-page .mode-card:hover {
  border-color: var(--caci-blue-light);
  background: var(--bg-hover);
}
.broadcast-page .mode-card.selected {
  border-color: var(--caci-blue);
  background: var(--caci-blue-bg);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.broadcast-page .mode-card .icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background 0.14s, color 0.14s, border-color 0.14s;
}
.broadcast-page .mode-card.selected .icon-wrap {
  background: var(--caci-blue);
  color: #fff;
  border-color: var(--caci-blue);
}
.broadcast-page .mode-card .mode-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}
.broadcast-page .mode-card .mode-sub {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.broadcast-page .mode-card .check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--caci-blue);
  color: #fff;
  display: none;
  align-items: center;
  justify-content: center;
}
.broadcast-page .mode-card .check i {
  font-size: 12px;
}
.broadcast-page .mode-card.selected .check {
  display: flex;
}

/* sub-pickers */
.broadcast-page .audience-detail {
  border-top: 1px solid var(--border-default);
  padding: 16px 18px;
  display: none;
}
.broadcast-page .audience-detail.active {
  display: block;
}

/* Everyone */
.broadcast-page .everyone-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-page);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  padding: 12px 14px;
}
.broadcast-page .everyone-confirm i {
  color: var(--caci-blue);
  font-size: 22px;
}
.broadcast-page .everyone-confirm .t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.broadcast-page .everyone-confirm .s {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 1px;
}

/* Group picker */
.broadcast-page .group-search {
  position: relative;
  margin-bottom: 10px;
}
.broadcast-page .group-search i {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--text-muted);
}
.broadcast-page .group-search input {
  width: 100%;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 12px 0 36px;
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.14s, box-shadow 0.14s;
}
.broadcast-page .group-search input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.broadcast-page .group-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 2px;
}
@media (max-width: 480px) {
  .broadcast-page .group-grid {
    grid-template-columns: 1fr;
  }
}

.broadcast-page .group-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 9px 10px;
  cursor: pointer;
  background: var(--bg-card);
  transition: border-color 0.12s, background 0.12s;
}
.broadcast-page .group-row:hover {
  border-color: var(--caci-blue-light);
}
.broadcast-page .group-row.checked {
  border-color: var(--caci-blue);
  background: var(--caci-blue-bg);
}
.broadcast-page .group-row .box {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s;
}
.broadcast-page .group-row.checked .box {
  background: var(--caci-blue);
  border-color: var(--caci-blue);
}
.broadcast-page .group-row.checked .box i {
  display: flex;
}
.broadcast-page .group-row .box i {
  display: none;
  font-size: 12px;
  color: #fff;
}
.broadcast-page .group-row .swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.broadcast-page .group-row .meta {
  flex: 1;
  min-width: 0;
}
.broadcast-page .group-row .gname {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.broadcast-page .group-row .gcount {
  font-size: 11.5px;
  color: var(--text-secondary);
}

/* Individuals picker */
.broadcast-page .people-search {
  position: relative;
  margin-bottom: 10px;
}
.broadcast-page .people-search i {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--text-muted);
}
.broadcast-page .people-search input {
  width: 100%;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 12px 0 36px;
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.14s, box-shadow 0.14s;
}
.broadcast-page .people-search input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.broadcast-page .people-results {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 10px;
  display: none;
}
.broadcast-page .people-results.open {
  display: block;
}
.broadcast-page .person-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-default);
}
.broadcast-page .person-row:last-child {
  border-bottom: none;
}
.broadcast-page .person-row:hover {
  background: var(--bg-hover);
}
.broadcast-page .person-row.added {
  opacity: 0.45;
  cursor: default;
}
.broadcast-page .p-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--caci-blue), var(--caci-red));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}
.broadcast-page .person-row .pname {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.broadcast-page .person-row .pmeta {
  font-size: 11.5px;
  color: var(--text-secondary);
}
.broadcast-page .person-row .add-flag {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--caci-blue);
  display: flex;
  align-items: center;
  gap: 3px;
}
.broadcast-page .person-row .add-flag i {
  font-size: 15px;
}
.broadcast-page .person-row.added .add-flag {
  color: var(--caci-success);
}

.broadcast-page .selected-people {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.broadcast-page .person-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  padding: 3px 6px 3px 3px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.broadcast-page .person-chip .p-avatar {
  width: 20px;
  height: 20px;
  font-size: 9px;
}
.broadcast-page .person-chip .rm {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
}
.broadcast-page .person-chip .rm:hover {
  background: var(--bg-danger);
  color: var(--caci-red);
}
.broadcast-page .person-chip .rm i {
  font-size: 13px;
}
.broadcast-page .empty-people {
  font-size: 12.5px;
  color: var(--text-muted);
  padding: 6px 2px;
}

/* Summary bar */
.broadcast-page .summary-bar {
  border-top: 1px solid var(--border-default);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: var(--bg-page);
}
.broadcast-page .summary-bar i {
  color: var(--caci-blue);
  font-size: 18px;
}
.broadcast-page .summary-bar .txt {
  font-size: 13px;
  color: var(--text-secondary);
}
.broadcast-page .summary-bar .txt strong {
  color: var(--text-primary);
  font-weight: 700;
}
.broadcast-page .summary-bar .count-pill {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--caci-blue-dim);
  background: var(--caci-blue-bg);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}
[data-theme="dark"] .broadcast-page .summary-bar .count-pill {
  color: var(--caci-blue-light);
}

/* ============================================================
   COMPOSER
   ============================================================ */
.broadcast-page .composer-panel {
  margin-bottom: 16px;
  overflow: hidden;
}

.broadcast-page .field-block {
  padding: 16px 18px 0 18px;
}
.broadcast-page .field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.broadcast-page .field-label i {
  font-size: 15px;
}

.broadcast-page .title-input {
  width: 100%;
  border: none;
  border-bottom: 2px solid var(--border-default);
  padding: 6px 2px 10px 2px;
  font-size: 17px;
  font-weight: 700;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  transition: border-color 0.15s;
}
.broadcast-page .title-input:focus {
  border-bottom-color: var(--caci-blue);
}
.broadcast-page .title-input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}
.broadcast-page .title-count {
  text-align: right;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}

.broadcast-page .toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  margin: 14px 18px 0 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-default);
}
.broadcast-page .tb-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.broadcast-page .tb-btn i {
  font-size: 19px;
}
.broadcast-page .tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.broadcast-page .tb-btn.active {
  background: var(--caci-blue-bg);
  color: var(--caci-blue);
}
.broadcast-page .tb-divider {
  width: 1px;
  height: 20px;
  background: var(--border-default);
  margin: 0 5px;
}

.broadcast-page .editor-wrap {
  margin: 0 18px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  margin-top: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
  overflow: hidden;
}
.broadcast-page .editor-wrap:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.broadcast-page .editor {
  min-height: 120px;
  max-height: 260px;
  overflow-y: auto;
  padding: 12px 14px;
  font-size: 13.5px;
  line-height: 1.65;
  outline: none;
  color: var(--text-primary);
}
.broadcast-page .editor:empty::before {
  content: 'Write your message…';
  color: var(--text-muted);
}
.broadcast-page .editor blockquote {
  border-left: 3px solid var(--caci-blue);
  padding-left: 12px;
  margin: 6px 0;
  color: var(--text-secondary);
}
.broadcast-page .editor ul,
.broadcast-page .editor ol {
  padding-left: 22px;
  margin: 6px 0;
}
.broadcast-page .editor a {
  color: var(--text-link);
  text-decoration: underline;
}

.broadcast-page .attach-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-default);
}
.broadcast-page .attach-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.broadcast-page .attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 9px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.14s;
}
.broadcast-page .attach-chip i {
  font-size: 16px;
}
.broadcast-page .attach-chip:hover {
  border-color: var(--caci-blue-light);
  color: var(--caci-blue);
}
.broadcast-page .attach-chip.has-file {
  border-color: var(--caci-blue);
  background: var(--caci-blue-bg);
  color: var(--caci-blue-dim);
}
.broadcast-page .attach-chip input[type=file] {
  display: none;
}
.broadcast-page .char-count {
  font-size: 11px;
  color: var(--text-muted);
}
.broadcast-page .char-count.warning {
  color: var(--caci-warning);
}
.broadcast-page .char-count.danger {
  color: var(--caci-red);
}

.broadcast-page .file-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border-radius: var(--radius-pill);
  font-size: 11.5px;
  font-weight: 600;
  background: var(--bg-page);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  max-width: 160px;
}
.broadcast-page .file-pill .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.broadcast-page .file-pill .remove {
  cursor: pointer;
  opacity: 0.55;
  font-size: 14px;
  line-height: 1;
}
.broadcast-page .file-pill .remove:hover {
  opacity: 1;
  color: var(--caci-red);
}
.broadcast-page .attached-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 18px;
  margin-top: 8px;
}
.broadcast-page .attached-files:empty {
  display: none;
}

.broadcast-page .image-preview {
  margin: 8px 18px 0;
  padding: 8px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  display: inline-block;
  max-width: 180px;
}
.broadcast-page .image-preview img {
  max-width: 100%;
  max-height: 100px;
  border-radius: 6px;
  object-fit: cover;
  display: block;
}
.broadcast-page .image-preview .remove-img {
  display: block;
  margin-top: 5px;
  text-align: center;
  font-size: 11px;
  color: var(--caci-red);
  cursor: pointer;
  font-weight: 600;
}
.broadcast-page .image-preview .remove-img:hover {
  text-decoration: underline;
}

/* ============================================================
   DELIVERY
   ============================================================ */
.broadcast-page .delivery-panel {
  padding: 16px 18px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}
.broadcast-page .delivery-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.broadcast-page .delivery-col .field-label {
  margin-bottom: 0;
}

.broadcast-page .seg-toggle {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.broadcast-page .seg-toggle label {
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-card);
  transition: background 0.12s, color 0.12s;
}
.broadcast-page .seg-toggle label:not(:last-child) {
  border-right: 1px solid var(--border-strong);
}
.broadcast-page .seg-toggle input {
  display: none;
}
.broadcast-page .seg-toggle input:checked + span {
  color: inherit;
}
.broadcast-page .seg-toggle label.on {
  background: var(--caci-blue);
  color: #fff;
}

.broadcast-page .schedule-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.broadcast-page .schedule-picker input {
  padding: 7px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.broadcast-page .schedule-picker input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.broadcast-page .recurring-select {
  padding: 7px 30px 7px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236e7681' stroke-width='1.6' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.broadcast-page .recurring-select:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ============================================================
   ACTION BAR
   ============================================================ */
.broadcast-page .action-bar {
  position: sticky;
  bottom: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.broadcast-page .recurring-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: var(--radius-pill);
  font-size: 11.5px;
  font-weight: 700;
  background: var(--caci-blue-bg);
  color: var(--caci-blue-dim);
}
.broadcast-page .recurring-badge i {
  font-size: 14px;
}
[data-theme="dark"] .broadcast-page .recurring-badge {
  color: var(--caci-blue-light);
}

.broadcast-page .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: var(--radius-md);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s, transform 0.1s;
}
.broadcast-page .btn i {
  font-size: 18px;
}
.broadcast-page .btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-default);
}
.broadcast-page .btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.broadcast-page .btn-primary {
  background: var(--caci-blue);
  color: #fff;
  border-color: var(--caci-blue-dim);
  box-shadow: 0 2px 8px rgba(0, 75, 160, 0.25);
}
.broadcast-page .btn-primary:hover {
  background: var(--caci-blue-mid);
}
.broadcast-page .btn-primary:active {
  transform: scale(0.98);
}
.broadcast-page .btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ============================================================
   TOAST (within page)
   ============================================================ */
.broadcast-page .toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  padding: 13px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 420px;
}
.broadcast-page .toast.hidden {
  display: none;
}
.broadcast-page .toast i {
  font-size: 22px;
  color: var(--caci-success);
}
.broadcast-page .toast .ttitle {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}
.broadcast-page .toast .tdetail {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 1px;
}
.broadcast-page .toast .tdismiss {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  background: none;
  border: none;
}
.broadcast-page .toast .tdismiss:hover {
  color: var(--text-primary);
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
.broadcast-page .toast:not(.hidden) {
  animation: fadeUp 0.25s ease;
}
`;

export default {
  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser();
    if (!user) {
      renderError(container, new Error('Not authenticated'), {});
      return;
    }

    // Inject styles (idempotent)
    if (!document.getElementById('broadcast-page-css')) {
      const style = document.createElement('style');
      style.id = 'broadcast-page-css';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    // Create the app instance and render
    const app = new CreateBroadcastApp(container, user);
    await app.init();
  },

  destroy(): void {
    // Cleanup: remove any global listeners? (We'll use local listeners)
  },
} as PageModule;

// ── Application class ──────────────────────────────────────────────────────────

type AudienceMode = 'everyone' | 'group' | 'individuals';

class CreateBroadcastApp {
  private container: HTMLElement;
  private user: any;
  private mode: AudienceMode = 'everyone';
  private selectedGroupIds = new Set<string>();
  private selectedPeopleIds = new Set<string>();
  private groups: GroupRow[] = [];
  private members: MemberRow[] = []; // cached members for search
  private attachments: Record<string, Attachment> = {};
  private currentAttachType: string | null = null;
  private totalMembers = 0;

  // DOM refs
  private els: any = {};

  constructor(container: HTMLElement, user: any) {
    this.container = container;
    this.user = user;
  }

  async init(): Promise<void> {
    // 1. Fetch initial data
    await this.fetchData();

    // 2. Render HTML
    this.renderHTML();

    // 3. Bind events
    this.bindEvents();

    // 4. Update UI state
    this.updateSummary();
    this.updateSendButton();
    this.renderGroups();
    this.renderSelectedPeople();

    // 5. Start listening to real-time? not needed for now
  }

  private async fetchData(): Promise<void> {
    const assemblyId = this.user.assemblyId;
    if (!assemblyId) throw new Error('No assembly selected');

    // Count total active members
    const { count, error: countErr } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (countErr) throw countErr;
    this.totalMembers = count || 0;

    // Fetch groups with member counts
    const { data: groupsData, error: groupsErr } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        group_members (member_id)
      `)
      .eq('assembly_id', assemblyId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (groupsErr) throw groupsErr;

    // Compute counts
    this.groups = (groupsData || []).map((g: any) => {
      const count = (g.group_members || []).length;
      // Assign a deterministic colour based on id
      const colors = ['#4D9FFF', '#C60026', '#1a7f37', '#9a6700', '#004BA0', '#1A6FC4', '#8C001A', '#FF1A46', '#003578'];
      const idx = g.id.charCodeAt(0) % colors.length;
      return {
        id: g.id,
        name: g.name,
        count,
        color: colors[idx],
      };
    });

    // Pre-fetch a few members for search (we'll search in real-time via API)
    // We'll query on demand in the search.
  }

  private renderHTML(): void {
    this.container.innerHTML = `
      <div class="broadcast-page">
        <div id="broadcast-breadcrumb"></div>

        <!-- ============================================================
             1. AUDIENCE
        ============================================================ -->
        <div class="panel audience-panel">
          <div class="audience-head">
            <span class="label"><i class="bi bi-people-fill"></i>Who should receive this?</span>
          </div>

          <div class="audience-modes">
            <button type="button" class="mode-card selected" data-mode="everyone">
              <span class="check"><i class="bi bi-check"></i></span>
              <span class="icon-wrap"><i class="bi bi-globe"></i></span>
              <span class="mode-title">Everyone</span>
              <span class="mode-sub">All active members in the assembly</span>
            </button>

            <button type="button" class="mode-card" data-mode="group">
              <span class="check"><i class="bi bi-check"></i></span>
              <span class="icon-wrap"><i class="bi bi-people"></i></span>
              <span class="mode-title">A Group</span>
              <span class="mode-sub">One or more ministries or teams</span>
            </button>

            <button type="button" class="mode-card" data-mode="individuals">
              <span class="check"><i class="bi bi-check"></i></span>
              <span class="icon-wrap"><i class="bi bi-person-search"></i></span>
              <span class="mode-title">Specific People</span>
              <span class="mode-sub">Hand-pick individual members</span>
            </button>
          </div>

          <!-- Everyone detail -->
          <div class="audience-detail active" id="detail-everyone">
            <div class="everyone-confirm">
              <i class="bi bi-info-circle"></i>
              <div>
                <div class="t">This message will go to all <span id="totalMembersCount">0</span> active members.</div>
                <div class="s">Inactive and archived members will not receive this broadcast.</div>
              </div>
            </div>
          </div>

          <!-- Group detail -->
          <div class="audience-detail" id="detail-group">
            <div class="group-search">
              <i class="bi bi-search"></i>
              <input type="text" id="groupSearch" placeholder="Search groups — Youth, Choir, Ushers…" />
            </div>
            <div class="group-grid" id="groupGrid"></div>
          </div>

          <!-- Individuals detail -->
          <div class="audience-detail" id="detail-individuals">
            <div class="people-search">
              <i class="bi bi-search"></i>
              <input type="text" id="peopleSearch" placeholder="Search members by name or phone…" autocomplete="off" />
            </div>
            <div class="people-results" id="peopleResults"></div>
            <div class="field-label" style="margin-bottom:6px;">Selected</div>
            <div class="selected-people" id="selectedPeople">
              <span class="empty-people">No one selected yet — search above to add people.</span>
            </div>
          </div>

          <!-- Live summary -->
          <div class="summary-bar">
            <i class="bi bi-send"></i>
            <span class="txt" id="summaryText">Sending to <strong>all 0 active members</strong></span>
            <span class="count-pill" id="summaryCount">0 recipients</span>
          </div>
        </div>

        <!-- ============================================================
             2. MESSAGE
        ============================================================ -->
        <div class="panel composer-panel">
          <div class="field-block">
            <span class="field-label"><i class="bi bi-pencil"></i>Message</span>
            <input class="title-input" id="titleInput" placeholder="Give your broadcast a title…" maxlength="80" />
            <div class="title-count"><span id="titleCount">0</span>/80</div>
          </div>

          <div class="toolbar" id="toolbar">
            <button class="tb-btn" data-command="bold" title="Bold (Ctrl+B)"><i class="bi bi-type-bold"></i></button>
            <button class="tb-btn" data-command="italic" title="Italic (Ctrl+I)"><i class="bi bi-type-italic"></i></button>
            <button class="tb-btn" data-command="underline" title="Underline (Ctrl+U)"><i class="bi bi-type-underline"></i></button>
            <span class="tb-divider"></span>
            <button class="tb-btn" data-command="blockquote" title="Quote"><i class="bi bi-quote"></i></button>
            <button class="tb-btn" data-command="insertUnorderedList" title="Bullet list"><i class="bi bi-list-ul"></i></button>
            <button class="tb-btn" data-command="insertOrderedList" title="Numbered list"><i class="bi bi-list-ol"></i></button>
            <span class="tb-divider"></span>
            <button class="tb-btn" data-command="createLink" title="Insert link"><i class="bi bi-link"></i></button>
            <button class="tb-btn" data-command="removeFormat" title="Clear formatting"><i class="bi bi-eraser"></i></button>
          </div>

          <div class="editor-wrap">
            <div class="editor" id="editor" contenteditable="true" role="textbox" aria-multiline="true"></div>
            <div class="attach-row">
              <div class="attach-chips">
                <label class="attach-chip" id="imageChip">
                  <i class="bi bi-image"></i>Image
                  <input type="file" id="imageInput" accept=".png,.jpg,.jpeg,.gif,.svg,.webp" />
                </label>
                <label class="attach-chip" id="audioChip">
                  <i class="bi bi-mic"></i>Audio
                  <input type="file" id="audioInput" accept=".mp3,.wav,.m4a" />
                </label>
                <label class="attach-chip" id="videoChip">
                  <i class="bi bi-camera-reels"></i>Video
                  <input type="file" id="videoInput" accept=".mp4,.mov,.avi" />
                </label>
                <label class="attach-chip" id="documentChip">
                  <i class="bi bi-file-text"></i>Document
                  <input type="file" id="docInput" accept=".pdf,.docx,.txt" />
                </label>
              </div>
              <span class="char-count" id="charCounter">0</span>
            </div>
          </div>

          <div class="attached-files" id="attachedFiles"></div>
          <div id="imagePreviewContainer" class="hidden"></div>
          <div style="height:16px;"></div>
        </div>

        <!-- ============================================================
             3. DELIVERY
        ============================================================ -->
        <div class="panel delivery-panel">
          <div class="delivery-col">
            <span class="field-label"><i class="bi bi-clock"></i>When</span>
            <div class="seg-toggle" id="scheduleToggle">
              <label class="on" data-value="now"><input type="radio" name="schedule" value="now" checked /><span>Send now</span></label>
              <label data-value="later"><input type="radio" name="schedule" value="later" /><span>Schedule</span></label>
            </div>
            <div class="schedule-picker hidden" id="schedulePicker">
              <input type="date" id="scheduleDate" />
              <input type="time" id="scheduleTime" value="07:00" />
            </div>
          </div>

          <div class="delivery-col">
            <span class="field-label"><i class="bi bi-arrow-repeat"></i>Repeat</span>
            <select class="recurring-select" id="recurringSelect">
              <option value="none">Doesn't repeat</option>
              <option value="daily" selected>Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <!-- ============================================================
             4. ACTION BAR
        ============================================================ -->
        <div class="action-bar">
          <span id="recurringBadge" class="recurring-badge">
            <i class="bi bi-arrow-repeat"></i>
            <span id="recurringLabel">Repeats daily</span>
          </span>
          <button class="btn btn-ghost" type="button" id="saveDraftBtn">
            <i class="bi bi-save"></i>Save draft
          </button>
          <div style="margin-left:auto; display:flex; align-items:center; gap:10px;">
            <button class="btn btn-primary" id="sendBtn" type="button">
              <i class="bi bi-send"></i>
              <span id="sendBtnLabel">Send broadcast</span>
            </button>
          </div>
        </div>

        <!-- Toast -->
        <div class="toast hidden" id="successToast">
          <i class="bi bi-check-circle-fill"></i>
          <div>
            <div class="ttitle" id="toastTitle">Broadcast sent!</div>
            <div class="tdetail" id="toastDetail">Your message is on its way.</div>
          </div>
          <button class="tdismiss" id="toastDismiss">Dismiss</button>
        </div>

      </div>
    `;

    // Store references
    this.els = {
      modeCards: this.container.querySelectorAll('.mode-card'),
      details: {
        everyone: this.container.querySelector('#detail-everyone'),
        group: this.container.querySelector('#detail-group'),
        individuals: this.container.querySelector('#detail-individuals'),
      },
      groupSearch: this.container.querySelector('#groupSearch'),
      groupGrid: this.container.querySelector('#groupGrid'),
      peopleSearch: this.container.querySelector('#peopleSearch'),
      peopleResults: this.container.querySelector('#peopleResults'),
      selectedPeople: this.container.querySelector('#selectedPeople'),
      summaryText: this.container.querySelector('#summaryText'),
      summaryCount: this.container.querySelector('#summaryCount'),
      totalMembersCount: this.container.querySelector('#totalMembersCount'),
      titleInput: this.container.querySelector('#titleInput'),
      titleCount: this.container.querySelector('#titleCount'),
      editor: this.container.querySelector('#editor'),
      charCounter: this.container.querySelector('#charCounter'),
      sendBtn: this.container.querySelector('#sendBtn'),
      sendBtnLabel: this.container.querySelector('#sendBtnLabel'),
      recurringSelect: this.container.querySelector('#recurringSelect'),
      recurringBadge: this.container.querySelector('#recurringBadge'),
      recurringLabel: this.container.querySelector('#recurringLabel'),
      scheduleToggle: this.container.querySelector('#scheduleToggle'),
      schedulePicker: this.container.querySelector('#schedulePicker'),
      scheduleDate: this.container.querySelector('#scheduleDate'),
      scheduleTime: this.container.querySelector('#scheduleTime'),
      imageInput: this.container.querySelector('#imageInput'),
      audioInput: this.container.querySelector('#audioInput'),
      videoInput: this.container.querySelector('#videoInput'),
      docInput: this.container.querySelector('#docInput'),
      attachedFiles: this.container.querySelector('#attachedFiles'),
      imagePreviewContainer: this.container.querySelector('#imagePreviewContainer'),
      successToast: this.container.querySelector('#successToast'),
      toastTitle: this.container.querySelector('#toastTitle'),
      toastDetail: this.container.querySelector('#toastDetail'),
      toastDismiss: this.container.querySelector('#toastDismiss'),
      saveDraftBtn: this.container.querySelector('#saveDraftBtn'),
      toolbar: this.container.querySelector('#toolbar'),
    };

    // Set default date
    const now = new Date();
    const localDate = now.toISOString().split('T')[0];
    this.els.scheduleDate.value = localDate;

    // Update total members count
    this.els.totalMembersCount.textContent = this.totalMembers.toLocaleString();

    // Render breadcrumbs
    const breadcrumbContainer = this.container.querySelector('#broadcast-breadcrumb') as HTMLElement;
    if (breadcrumbContainer) {
      renderBreadcrumbs(breadcrumbContainer, [
        { label: 'All Broadcasts', path: '/communications' },
        { label: 'New Broadcast' },
      ]);
    }
  }

  private bindEvents(): void {
    // Audience mode cards
    this.els.modeCards.forEach((card: HTMLElement) => {
      card.addEventListener('click', () => {
        this.mode = card.dataset.mode as AudienceMode;
        this.els.modeCards.forEach((c: HTMLElement) => c.classList.toggle('selected', c === card));
        Object.entries(this.els.details).forEach(([key, el]) => {
          (el as HTMLElement).classList.toggle('active', key === this.mode);
        });
        this.updateSummary();
        this.renderGroups(); // re-render groups in case of filter
        this.renderSelectedPeople();
      });
    });

    // Group search
    this.els.groupSearch?.addEventListener('input', () => this.renderGroups());

    // Group selection
    this.els.groupGrid?.addEventListener('click', (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.group-row') as HTMLElement | null;
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      if (this.selectedGroupIds.has(id)) this.selectedGroupIds.delete(id);
      else this.selectedGroupIds.add(id);
      row.classList.toggle('checked');
      this.updateSummary();
    });

    // People search
    this.els.peopleSearch?.addEventListener('input', () => this.searchPeople());

    // People results click
    this.els.peopleResults?.addEventListener('click', (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.person-row') as HTMLElement | null;
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      if (this.selectedPeopleIds.has(id)) return;
      this.selectedPeopleIds.add(id);
      this.renderSelectedPeople();
      this.els.peopleSearch.value = '';
      this.els.peopleResults.classList.remove('open');
      this.updateSummary();
    });

    // Close people results on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.people-search') && !target.closest('.people-results')) {
        this.els.peopleResults.classList.remove('open');
      }
    });

    // Title input
    this.els.titleInput?.addEventListener('input', () => {
      this.els.titleCount.textContent = this.els.titleInput.value.length;
      this.updateSendButton();
    });

    // Editor events
    const editor = this.els.editor;
    editor?.addEventListener('input', () => {
      this.updateCharCount();
      this.updateSendButton();
    });

    // Toolbar buttons
    this.els.toolbar?.addEventListener('click', (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.tb-btn') as HTMLElement | null;
      if (!btn) return;
      const cmd = btn.dataset.command;
      if (!cmd) return;
      this.executeCommand(cmd);
    });

    // Keyboard shortcuts in editor
    editor?.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const cmd = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
        if (cmd) this.executeCommand(cmd);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.sendBroadcast();
      }
    });

    // Attachment inputs
    ['image', 'audio', 'video', 'document'].forEach(type => {
      const input = this.els[`${type}Input`];
      if (input) {
        input.addEventListener('change', () => this.handleAttach(input, type));
      }
    });

    // Remove attachment via attached files (delegated)
    this.els.attachedFiles?.addEventListener('click', (e: MouseEvent) => {
      const remove = (e.target as HTMLElement).closest('.remove') as HTMLElement | null;
      if (!remove) return;
      const parent = remove.closest('.file-pill') as HTMLElement | null;
      if (!parent) return;
      // Find the type by data attribute
      const type = parent.dataset.type;
      if (type) this.removeAttachment(type);
    });

    // Image preview remove
    this.els.imagePreviewContainer?.addEventListener('click', (e: MouseEvent) => {
      const rm = (e.target as Element).closest('.remove-img');
      if (rm) this.removeAttachment('image');
    });

    // Schedule toggle
    this.els.scheduleToggle?.querySelectorAll('label').forEach((label: HTMLElement) => {
      label.addEventListener('click', () => {
        this.els.scheduleToggle.querySelectorAll('label').forEach((l: HTMLElement) => l.classList.remove('on'));
        label.classList.add('on');
        this.els.schedulePicker.classList.toggle('hidden', label.dataset.value !== 'later');
      });
    });

    // Recurring select
    this.els.recurringSelect?.addEventListener('change', () => {
      const val = this.els.recurringSelect.value;
      if (val === 'none') {
        this.els.recurringBadge.classList.add('hidden');
        return;
      }
      const labels: Record<string, string> = {
        daily: 'Repeats daily',
        weekly: 'Repeats weekly',
        biweekly: 'Repeats every 2 weeks',
        monthly: 'Repeats monthly',
      };
      this.els.recurringLabel.textContent = labels[val] || val;
      this.els.recurringBadge.classList.remove('hidden');
    });

    // Send button
    this.els.sendBtn?.addEventListener('click', () => this.sendBroadcast());

    // Save draft
    this.els.saveDraftBtn?.addEventListener('click', () => this.saveDraft());

    // Toast dismiss
    this.els.toastDismiss?.addEventListener('click', () => this.dismissToast());
  }

  // ── Helper methods ──

  private executeCommand(cmd: string): void {
    const editor = this.els.editor;
    if (!editor) return;
    editor.focus();
    switch (cmd) {
      case 'bold':
      case 'italic':
      case 'underline':
        document.execCommand(cmd, false);
        break;
      case 'blockquote':
        document.execCommand('formatBlock', false, 'blockquote');
        break;
      case 'insertUnorderedList':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'insertOrderedList':
        document.execCommand('insertOrderedList', false);
        break;
      case 'removeFormat':
        document.execCommand('removeFormat', false);
        break;
      case 'createLink': {
        const url = prompt('Enter URL:', 'https://');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
      default:
        return;
    }
    this.updateCharCount();
    this.updateToolbarState();
  }

  private updateToolbarState(): void {
    const commands = ['bold', 'italic', 'underline', 'blockquote', 'insertUnorderedList', 'insertOrderedList'];
    this.els.toolbar?.querySelectorAll('.tb-btn').forEach((btn: HTMLElement) => {
      const cmd = btn.dataset.command;
      if (cmd && commands.includes(cmd)) {
        try {
          btn.classList.toggle('active', document.queryCommandState(cmd));
        } catch (_) { /* ignore */ }
      }
    });
  }

  private updateCharCount(): void {
    const len = (this.els.editor?.innerText || '').length;
    this.els.charCounter.textContent = len;
    this.els.charCounter.className = 'char-count' + (len > 400 ? ' warning' : '') + (len > 500 ? ' danger' : '');
  }

  private updateSummary(): void {
    const total = this.totalMembers;
    if (this.mode === 'everyone') {
      this.els.summaryText.innerHTML = `Sending to <strong>all ${total.toLocaleString()} active members</strong>`;
      this.els.summaryCount.textContent = `${total.toLocaleString()} recipients`;
    } else if (this.mode === 'group') {
      const groups = this.groups.filter(g => this.selectedGroupIds.has(g.id));
      const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
      if (groups.length === 0) {
        this.els.summaryText.innerHTML = `Choose at least one group above`;
        this.els.summaryCount.textContent = `0 recipients`;
      } else if (groups.length === 1) {
        this.els.summaryText.innerHTML = `Sending to <strong>${groups[0].name}</strong> (${groups[0].count} members)`;
        this.els.summaryCount.textContent = `${totalCount.toLocaleString()} recipients`;
      } else {
        this.els.summaryText.innerHTML = `Sending to <strong>${groups.length} groups</strong>: ${groups.map(g => g.name).join(', ')}`;
        this.els.summaryCount.textContent = `~${totalCount.toLocaleString()} recipients`;
      }
    } else {
      const n = this.selectedPeopleIds.size;
      if (n === 0) {
        this.els.summaryText.innerHTML = `Search and add people above`;
        this.els.summaryCount.textContent = `0 recipients`;
      } else {
        this.els.summaryText.innerHTML = `Sending to <strong>${n} selected ${n === 1 ? 'person' : 'people'}</strong>`;
        this.els.summaryCount.textContent = `${n} recipient${n === 1 ? '' : 's'}`;
      }
    }
    this.updateSendButton();
  }

  private updateSendButton(): void {
    const title = this.els.titleInput.value.trim();
    const text = (this.els.editor?.innerText || '').trim();
    const hasAttach = Object.keys(this.attachments).length > 0;
    const canSend = title.length > 0 && (text.length > 0 || hasAttach) && this.audienceIsValid();
    this.els.sendBtn.disabled = !canSend;
    this.els.sendBtn.style.opacity = canSend ? '1' : '0.5';
  }

  private audienceIsValid(): boolean {
    if (this.mode === 'everyone') return true;
    if (this.mode === 'group') return this.selectedGroupIds.size > 0;
    return this.selectedPeopleIds.size > 0;
  }

  private audienceLabel(): string {
    if (this.mode === 'everyone') return `All members (${this.totalMembers.toLocaleString()})`;
    if (this.mode === 'group') {
      const groups = this.groups.filter(g => this.selectedGroupIds.has(g.id));
      return groups.map(g => g.name).join(', ') || 'No group selected';
    }
    return `${this.selectedPeopleIds.size} selected ${this.selectedPeopleIds.size === 1 ? 'person' : 'people'}`;
  }

  private async searchPeople(): Promise<void> {
    const query = this.els.peopleSearch.value.trim();
    const results = this.els.peopleResults;
    if (!query) {
      results.classList.remove('open');
      results.innerHTML = '';
      return;
    }

    try {
      const { data, error } = await supabase
        .from('members_view')
        .select('id, first_name, last_name, primary_phone, membership_status')
        .eq('assembly_id', this.user.assemblyId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .ilike('first_name', `%${query}%`)
        .or(`last_name.ilike.%${query}%,primary_phone.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        results.innerHTML = `<div class="empty-people" style="padding:10px;">No members found for "${query}"</div>`;
        results.classList.add('open');
        return;
      }

      results.innerHTML = data.map((row: any) => {
        const name = `${row.first_name} ${row.last_name}`.trim();
        const meta = `${row.membership_status} · ${row.primary_phone || 'No phone'}`;
        const added = this.selectedPeopleIds.has(row.id);
        const initials = name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
        return `
          <div class="person-row ${added ? 'added' : ''}" data-id="${row.id}">
            <span class="p-avatar">${initials}</span>
            <span>
              <div class="pname">${name}</div>
              <div class="pmeta">${meta}</div>
            </span>
            <span class="add-flag">
              <i class="bi ${added ? 'bi-check-circle-fill' : 'bi-plus-circle'}"></i>
              ${added ? 'Added' : 'Add'}
            </span>
          </div>
        `;
      }).join('');
      results.classList.add('open');
    } catch (err) {
      console.error('[CreateBroadcast] Search error', err);
    }
  }

  private renderGroups(filter = ''): void {
    const f = filter.trim().toLowerCase();
    const rows = this.groups.filter(g => g.name.toLowerCase().includes(f));
    const grid = this.els.groupGrid;
    if (!grid) return;
    if (rows.length === 0) {
      grid.innerHTML = `<div class="empty-people">No groups match "${filter}"</div>`;
      return;
    }
    grid.innerHTML = rows.map(g => `
      <div class="group-row ${this.selectedGroupIds.has(g.id) ? 'checked' : ''}" data-id="${g.id}">
        <span class="box"><i class="bi bi-check"></i></span>
        <span class="swatch" style="background:${g.color}"></span>
        <span class="meta">
          <div class="gname">${g.name}</div>
          <div class="gcount">${g.count} members</div>
        </span>
      </div>
    `).join('');
  }

  private renderSelectedPeople(): void {
    const wrap = this.els.selectedPeople;
    if (!wrap) return;
    if (this.selectedPeopleIds.size === 0) {
      wrap.innerHTML = `<span class="empty-people">No one selected yet — search above to add people.</span>`;
      return;
    }
    // We need to fetch member names for the chips; we'll use cached or query individually.
    // For simplicity, we'll re-query the selected members.
    this.fetchSelectedMembers().then(members => {
      const chips = members.map(m => `
        <span class="person-chip" data-id="${m.id}">
          <span class="p-avatar">${initials(m.name)}</span>
          ${m.name}
          <span class="rm" data-id="${m.id}"><i class="bi bi-x"></i></span>
        </span>
      `).join('');
      wrap.innerHTML = chips;
      // Bind remove events
      wrap.querySelectorAll('.rm').forEach((btn: HTMLElement) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (id) {
            this.selectedPeopleIds.delete(id);
            this.renderSelectedPeople();
            this.updateSummary();
            // Also re-render search results if open
            if (this.els.peopleResults.classList.contains('open')) {
              this.searchPeople();
            }
          }
        });
      });
    });
  }

  private async fetchSelectedMembers(): Promise<{ id: string; name: string }[]> {
    if (this.selectedPeopleIds.size === 0) return [];
    const ids = Array.from(this.selectedPeopleIds);
    const { data, error } = await supabase
      .from('members_view')
      .select('id, first_name, last_name')
      .in('id', ids)
      .eq('is_active', true)
      .is('deleted_at', null);
    if (error) {
      console.error('[CreateBroadcast] fetch selected members error', error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`.trim(),
    }));
  }

  // ── Attachment handling ──

  private async handleAttach(input: HTMLInputElement, type: string): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    // Remove any existing attachment (only one allowed)
    const existingTypes = Object.keys(this.attachments);
    for (const t of existingTypes) {
      this.removeAttachment(t, true); // pass silent flag to avoid re-rendering multiple times
    }

    // Now add the new one
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const attachment: Attachment = {
      type: type as any,
      file,
      name: file.name,
      size: `${sizeMB} MB`,
    };

    // For images, generate preview
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => {
        attachment.dataUrl = e.target?.result as string;
        this.renderImagePreview(attachment.dataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      // Clear any existing image preview if switching to non-image
      this.els.imagePreviewContainer.classList.add('hidden');
      this.els.imagePreviewContainer.innerHTML = '';
    }

    this.attachments[type] = attachment;

    // Update chip highlights: only the active type gets 'has-file'
    ['imageChip', 'audioChip', 'videoChip', 'documentChip'].forEach(id => {
      const chip = this.container.querySelector(`#${id}`) as HTMLElement;
      if (chip) chip.classList.remove('has-file');
    });
    const chip = this.container.querySelector(`#${type}Chip`) as HTMLElement;
    if (chip) chip.classList.add('has-file');

    this.renderFilePills();
    this.updateSendButton();
    input.value = '';
  }

  private renderImagePreview(dataUrl: string): void {
    const container = this.els.imagePreviewContainer;
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="image-preview">
        <img src="${dataUrl}" alt="Image attachment" />
        <span class="remove-img">✕ Remove image</span>
      </div>
    `;
    // Remove handler already bound via delegation.
  }

  private removeAttachment(type: string, silent = false): void {
    delete this.attachments[type];

    // Clear chip highlight for all types (since only one attachment can exist)
    ['imageChip', 'audioChip', 'videoChip', 'documentChip'].forEach(id => {
      const chip = this.container.querySelector(`#${id}`) as HTMLElement;
      if (chip) chip.classList.remove('has-file');
    });

    // Clear image preview if it was the image attachment
    if (type === 'image') {
      this.els.imagePreviewContainer.classList.add('hidden');
      this.els.imagePreviewContainer.innerHTML = '';
    }

    if (!silent) {
      this.renderFilePills();
      this.updateSendButton();
    }
  }

  private renderFilePills(): void {
    const container = this.els.attachedFiles;
    if (!container) return;

    const keys = Object.keys(this.attachments);
    if (keys.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Only one attachment is allowed – take the first (and only) key
    const key = keys[0];
    const att = this.attachments[key];
    const icons: Record<string, string> = {
      audio: 'bi-mic',
      video: 'bi-camera-reels',
      document: 'bi-file-text',
      image: 'bi-image',
    };
    const icon = icons[key] || 'bi-file-earmark';

    container.innerHTML = `
      <span class="file-pill" data-type="${key}" style="border-color:var(--caci-blue);color:var(--caci-blue-dim);background:var(--caci-blue-bg);">
        <i class="bi ${icon}"></i>
        <span class="name">${att.name}</span>
        <span class="remove" data-type="${key}">✕</span>
      </span>
    `;
  }


  // ── Send / Save ──

  private async sendBroadcast(): Promise<void> {
    if (this.els.sendBtn.disabled) return;
    const title = this.els.titleInput.value.trim() || 'Untitled';
    const body = this.els.editor?.innerHTML || '';
    const isLater = this.els.scheduleToggle.querySelector('label.on')?.dataset.value === 'later';
    const recurring = this.els.recurringSelect.value;
    const scheduleDate = this.els.scheduleDate.value;
    const scheduleTime = this.els.scheduleTime.value;

    // Build audience IDs
    let audienceIds: string[] = [];
    let audienceType: string;
    if (this.mode === 'everyone') {
      audienceType = 'assembly';
      audienceIds = [];
    } else if (this.mode === 'group') {
      audienceType = 'group';
      audienceIds = Array.from(this.selectedGroupIds);
    } else {
      audienceType = 'member_list';
      audienceIds = Array.from(this.selectedPeopleIds);
    }

    // Determine channel: we'll default to "in_app" for now
    const channel = 'in_app';

    try {
      this.els.sendBtn.disabled = true;
      this.els.sendBtnLabel.textContent = 'Sending…';

      // 1. Create a template
      const { data: template, error: templateErr } = await supabase
        .from('communication_templates')
        .insert({
          assembly_id: this.user.assemblyId,
          title: `Broadcast: ${title}`,
          body: body,
          channel: channel,
          category: 'broadcast',
          created_by: this.user.id,
        })
        .select('id')
        .single();

      if (templateErr) throw templateErr;

      // 2. Upload attachments if any (only one allowed)
      let attachmentId: string | null = null;
      const attKeys = Object.keys(this.attachments);
      if (attKeys.length > 0) {
        const firstType = attKeys[0];
        const att = this.attachments[firstType];
        const filePath = `broadcasts/${this.user.assemblyId}/${Date.now()}_${att.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('campaigns-media-private')
          .upload(filePath, att.file);
        if (uploadErr) throw uploadErr;

        // Insert attachment record
        const { data: attData, error: attErr } = await supabase
          .from('communication_attachments')
          .insert({
            assembly_id: this.user.assemblyId,
            storage_tier: 'hot',
            storage_provider: 'supabase',
            storage_bucket: 'campaigns-media-private',
            storage_path: filePath,
            mime_type: att.file.type,
            file_size_bytes: att.file.size,
            uploaded_by: this.user.id,
          })
          .select('id')
          .single();
        if (attErr) throw attErr;
        attachmentId = attData.id;
      }

      // 3. Create campaign
      const scheduledAt = isLater ? `${scheduleDate}T${scheduleTime}:00` : null;
      const status = scheduledAt ? 'scheduled' : 'draft';

      const campaignInsert: any = {
        assembly_id: this.user.assemblyId,
        template_id: template.id,
        title: title,
        channel: channel,
        audience_type: audienceType,
        audience_ids: audienceIds,
        trigger_type: recurring !== 'none' ? 'custom' : 'manual',
        status: status,
        scheduled_at: scheduledAt,
        created_by: this.user.id,
      };
      if (attachmentId) {
        campaignInsert.attachment_id = attachmentId;
      }

      const { data: campaign, error: campaignErr } = await supabase
        .from('communication_campaigns')
        .insert(campaignInsert)
        .select('id')
        .single();

      if (campaignErr) throw campaignErr;

      // 4. If sending now, trigger dispatch via Edge Function
      if (!scheduledAt) {
        console.log('[CreateBroadcast] Invoking comm-fanout for campaign:', campaign.id);
        const { error: fanoutErr } = await supabase.functions.invoke('comm-fanout', {
          body: { campaign_id: campaign.id },
        });
        if (fanoutErr) {
          console.error('[CreateBroadcast] Edge Function error (comm-fanout):', fanoutErr);
          throw new Error(`Fanout service (comm-fanout) returned error: ${fanoutErr.message || 'Unknown'}`);
        }

        console.log('[CreateBroadcast] Invoking comm-dispatch for campaign:', campaign.id);
        const { data: dispatchData, error: dispatchErr } = await supabase.functions.invoke('comm-dispatch');
        if (dispatchErr) {
          console.error('[CreateBroadcast] Edge Function error (comm-dispatch):', dispatchErr);
          // We'll throw a custom error that includes the function name and details
          throw new Error(`Dispatch service (comm-dispatch) returned error: ${dispatchErr.message || 'Unknown'}`);
        }
        console.log('[CreateBroadcast] Dispatch response:', dispatchData);
      }

      // 5. Show success toast
      const scheduleText = scheduledAt ? ` · Scheduled ${scheduledAt}` : ' · Sending now';
      const recurringText = recurring !== 'none' ? ` · Recurring (${recurring})` : '';
      const attachSummary = Object.keys(this.attachments).length ? ' · with attachment' : '';
      this.els.toastTitle.textContent = `"${title}" sent`;
      this.els.toastDetail.textContent = `To: ${this.audienceLabel()}${scheduleText}${recurringText}${attachSummary}`;
      this.els.successToast.classList.remove('hidden');

      // Reset button
      this.els.sendBtnLabel.textContent = 'Send broadcast';
      this.els.sendBtn.disabled = false;
      this.updateSendButton();

    } catch (err) {
      console.error('[CreateBroadcast] Send error', err);
      let msg = 'Failed to send broadcast. ';
      if (err instanceof Error) {
        msg += err.message;
        // Check if the error is related to Edge Function
        if (err.message.includes('comm-dispatch') || err.message.includes('comm-fanout') || err.message.includes('Edge Function')) {
          msg += ' The communication dispatch service may not be available. Please ensure the comm-dispatch Edge Function is deployed and accessible.';
        }
      } else {
        msg += 'Unknown error.';
      }
      // Show toast error (we can use a custom error toast, but we'll use showToast for now)
      showToast(msg);
      this.els.sendBtnLabel.textContent = 'Send broadcast';
      this.els.sendBtn.disabled = false;
      this.updateSendButton();
    }
  }

  private async saveDraft(): Promise<void> {
    // Similar to send but with status = 'draft' and no dispatch
    showToast('Draft saved (coming soon)');
  }

  private dismissToast(): void {
    this.els.successToast.classList.add('hidden');
  }
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}