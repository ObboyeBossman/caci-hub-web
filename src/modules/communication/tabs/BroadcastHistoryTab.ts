// src/modules/communication/tabs/BroadcastHistoryTab.ts

import type { WorkspaceTab }   from '../workspace/CommunicationWorkspaceShell'
import { getActiveAssemblyId } from '@core/auth'
import { on, off }              from '@core/events'
import { CommunicationService } from '../services/communication.service'
import type { Campaign, AttachmentMediaCategory } from '../schemas/communication'
import defaultImage from '../../../asset/images (2).jpeg'
import { navigate } from '@core/router'

type ArchiveType = 'video' | 'audio' | 'text' | 'document'

function _archiveType(c: Campaign): ArchiveType {
  // 1. Explicit channel values
  if (c.channel === 'video')    return 'video';
  if (c.channel === 'audio')    return 'audio';
  if (c.channel === 'document') return 'document';
  if (c.channel === 'image')    return 'image' as any; // if we ever use it

  // 2. If channel is 'in_app' or other, check attachment
  if (c.attachment?.media_category) {
    const cat = c.attachment.media_category;
    if (cat === 'video')   return 'video';
    if (cat === 'audio')   return 'audio';
    if (cat === 'image')   return 'document'; // treat image as document for now (or create separate type)
    if (cat === 'document') return 'document';
  }

  // 3. Fallback to text
  return 'text';
}

function _fmt(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── CSS ───────────────────────────────────────────────────────────────────
const BH_CSS = /* css */`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

/* ── Root & Base ── */
.ss-bh {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --bh-accent:      #f5a623;
  --bh-accent-dark: #d98e1a;
  --bh-navy:        #0b1a2e;
  --bh-navy-light:  #1a3a5c;
  --bh-radius:      16px;
  --bh-radius-sm:   10px;
  --bh-shadow:      0 8px 32px rgba(0,0,0,0.06);
  --bh-shadow-hover:0 20px 48px rgba(0,0,0,0.10);
  --bh-transition:  0.35s cubic-bezier(0.4,0,0.2,1);
}

/* ── Header ── */
.bh-header {
  display: flex; flex-direction: column; gap: 20px; margin-bottom: 28px;
}
@media (min-width: 768px) {
  .bh-header { flex-direction: row; align-items: flex-end; justify-content: space-between; }
}
.bh-breadcrumb {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;
}
.bh-breadcrumb span.sep { opacity: 0.5; font-size: 16px; }
.bh-breadcrumb span.cur { color: var(--text-primary); font-weight: 500; }
.bh-title {
  font-size: clamp(26px, 4vw, 36px); font-weight: 900;
  color: var(--text-primary); letter-spacing: -0.03em; margin: 0 0 6px 0;
}
.bh-subtitle {
  font-size: 14px; color: var(--text-secondary); max-width: 580px;
  line-height: 1.6; margin: 0;
}
.bh-header-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* ── Search ── */
.bh-search-wrap {
  position: relative; display: flex; align-items: center;
}
.bh-search-wrap i {
  position: absolute; left: 16px; color: var(--text-secondary);
  opacity: 0.55; pointer-events: none; font-size: 18px;
}
.bh-search-wrap input {
  background: var(--bg-card); border: 1.5px solid var(--border-default);
  border-radius: 100px; padding: 10px 40px 10px 44px;
  font-size: 14px; width: 260px; color: var(--text-primary);
  font-family: inherit; transition: all 0.3s; outline: none;
}
.bh-search-wrap input:focus {
  border-color: var(--bh-accent);
  box-shadow: 0 0 0 4px rgba(245,166,35,0.12);
}
.bh-search-wrap input::placeholder { color: var(--text-secondary); opacity: 0.6; }
.bh-search-hint {
  position: absolute; right: 14px; font-size: 10px; font-weight: 700;
  color: var(--text-secondary); opacity: 0.4; pointer-events: none;
}
.bh-icon-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-secondary); display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.bh-icon-btn:hover { color: var(--text-primary); border-color: var(--bh-accent); }
.bh-new-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--bh-navy); color: #fff; border: none;
  padding: 10px 20px; border-radius: 100px; font-size: 13px;
  font-weight: 700; font-family: inherit; cursor: pointer;
  transition: all 0.2s; box-shadow: 0 4px 16px rgba(11,26,46,0.2);
  white-space: nowrap;
}
.bh-new-btn:hover { transform: scale(1.03); box-shadow: 0 8px 24px rgba(11,26,46,0.3); }
.bh-new-btn i { font-size: 18px; }

/* ── Filter Chips ── */
.bh-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; align-items: center; }
.bh-chip {
  padding: 6px 16px; border-radius: 100px; font-size: 12px; font-weight: 600;
  border: 1.5px solid var(--border-default); background: transparent;
  color: var(--text-secondary); cursor: pointer; transition: all 0.25s;
  font-family: inherit;
}
.bh-chip:hover { border-color: var(--bh-accent); color: var(--text-primary); }
.bh-chip.active { background: var(--bh-accent); border-color: var(--bh-accent); color: #fff; }
.bh-chip-reset {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--text-secondary); opacity: 0.6;
  display: flex; align-items: center; gap: 4px; transition: opacity 0.2s;
  font-family: inherit;
}
.bh-chip-reset:hover { opacity: 1; }

/* ── Stat Cards ── */
.bh-stats {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 32px;
}
@media (min-width: 768px) { .bh-stats { grid-template-columns: repeat(4, 1fr); } }
.bh-stat {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius); padding: 20px 22px;
  position: relative; overflow: hidden;
  transition: all var(--bh-transition); cursor: default;
}
.bh-stat::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--bh-accent), #f7c948);
  opacity: 0; transition: opacity var(--bh-transition);
}
.bh-stat:hover::after { opacity: 1; }
.bh-stat:hover {
  transform: translateY(-2px);
  border-color: rgba(245,166,35,0.3);
  box-shadow: var(--bh-shadow-hover);
}
.bh-stat-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.bh-stat-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-secondary);
}
.bh-stat-badge {
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px;
}
.bh-stat-badge.green { background: rgba(16,185,129,0.1); color: #10b981; }
.bh-stat-badge.amber { background: rgba(245,158,11,0.1); color: #d97706; }
.bh-stat-val {
  font-size: 28px; font-weight: 900; color: var(--text-primary);
  letter-spacing: -0.02em; line-height: 1;
}
.bh-mini-chart { display: flex; align-items: flex-end; gap: 3px; height: 32px; margin-top: 8px; }
.bh-mini-chart .bar {
  flex: 1; border-radius: 2px 2px 0 0;
  background: var(--bh-accent); opacity: 0.35; min-height: 4px;
}
.bh-mini-chart .bar.hi { opacity: 0.9; }
.bh-progress-thin {
  width: 100%; height: 7px; background: var(--border-default);
  border-radius: 100px; overflow: hidden; margin-top: 10px;
}
.bh-progress-thin-fill {
  height: 100%; border-radius: 100px;
  background: linear-gradient(90deg, var(--bh-accent), #f7c948);
}
.bh-stat-footnote {
  font-size: 11px; color: var(--text-secondary); margin-top: 8px;
  display: flex; align-items: center; gap: 6px;
}
.bh-stat-footnote i { color: #10b981; font-size: 16px; }

/* ── Grid ── */
.bh-grid {
  display: grid; grid-template-columns: repeat(12, 1fr); gap: 18px;
}
.bh-col-4 { grid-column: span 12; }
.bh-col-8 { grid-column: span 12; }
@media (min-width: 1024px) {
  .bh-col-4 { grid-column: span 4; }
  .bh-col-8 { grid-column: span 8; }
}

/* ── Cards ── */
.bh-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius); box-shadow: var(--bh-shadow);
  transition: all var(--bh-transition); cursor: pointer;
  overflow: hidden; display: flex; flex-direction: column;
}
.bh-card:hover {
  transform: translateY(-4px); box-shadow: var(--bh-shadow-hover);
  border-color: rgba(245,166,35,0.25);
}

/* ── Video Card ── */
.bh-c-video { flex-direction: column; }
@media (min-width: 768px) { .bh-c-video { flex-direction: row; } }
.bh-thumb {
  position: relative; height: 210px;
  background: var(--bh-navy); overflow: hidden; flex-shrink: 0;
}
@media (min-width: 768px) { .bh-thumb { width: 42%; height: auto; } }
.bh-thumb img {
  width: 100%; height: 100%; object-fit: cover; opacity: 0.75;
  transition: transform 0.7s ease;
}
.bh-card:hover .bh-thumb img { transform: scale(1.05); }
.bh-thumb-overlay {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; background: rgba(0,0,0,0.28);
  opacity: 0; transition: opacity 0.3s;
}
.bh-card:hover .bh-thumb-overlay { opacity: 1; }
.bh-thumb-overlay i { font-size: 52px; color: #fff; }
.bh-thumb-badge { position: absolute; bottom: 12px; left: 12px; }
.bh-thumb-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%);
  pointer-events: none;
}

/* ── Card Body ── */
.bh-card-body { padding: 20px 22px; flex: 1; display: flex; flex-direction: column; }
.bh-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.bh-to { font-size: 11px; font-weight: 800; color: var(--bh-accent); text-transform: uppercase; letter-spacing: 0.05em; }
.bh-card-title { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 2px 0 8px 0; line-height: 1.3; }
.bh-card-desc {
  font-size: 13px; color: var(--text-secondary); line-height: 1.65; flex: 1;
  margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3;
  -webkit-box-orient: vertical; overflow: hidden;
}
.bh-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; border-top: 1px solid var(--border-default);
  padding-top: 14px; margin-top: auto;
}
.bh-stat-inline { display: flex; align-items: center; gap: 16px; }
.bh-stat-inline > div { display: flex; align-items: center; gap: 4px; }
.bh-stat-num { font-size: 17px; font-weight: 800; color: var(--text-primary); }
.bh-stat-lbl { font-size: 11px; font-weight: 500; color: var(--text-secondary); }
.bh-date-lbl { font-size: 11px; color: var(--text-secondary); }

/* ── Audio Card ── */
.bh-c-audio { padding: 22px; display: flex; flex-direction: column; }
.bh-icon-box {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; margin-bottom: 14px; flex-shrink: 0;
}
.bh-icon-audio { background: rgba(219,39,119,0.1); color: #db2777; }
.bh-icon-text  { background: rgba(5,150,105,0.1);  color: #059669; }
.bh-icon-doc   { background: rgba(217,119,6,0.1);  color: #d97706; }
.bh-progress-bar {
  height: 4px; border-radius: 4px; background: var(--border-default);
  overflow: hidden; margin-bottom: 14px;
}
.bh-progress-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, var(--bh-accent), #f7c948);
  width: 0%; transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
}
.bh-audio-stats { display: flex; align-items: center; gap: 14px; }
.bh-audio-stats span { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--text-primary); }
.bh-audio-stats span i { font-size: 17px; color: var(--text-secondary); }
.bh-details-btn {
  background: none; border: none; color: var(--bh-accent);
  font-weight: 700; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 2px; font-family: inherit;
  transition: opacity 0.2s;
}
.bh-details-btn:hover { opacity: 0.75; }

/* ── Text Card ── */
.bh-c-text { padding: 22px; display: flex; flex-direction: column; }
.bh-receipt-btn {
  background: none; border: none; color: var(--bh-accent);
  font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: opacity 0.2s;
}
.bh-receipt-btn:hover { opacity: 0.75; }

/* ── Document Card ── */
.bh-c-doc { flex-direction: column; }
@media (min-width: 768px) { .bh-c-doc { flex-direction: row; } }
.bh-doc-body { padding: 22px 26px; flex: 1; display: flex; flex-direction: column; }
.bh-doc-mock {
  display: none; width: 30%; background: var(--bg-page, var(--bg-card));
  border-left: 1px solid var(--border-default);
  padding: 20px; align-items: center; justify-content: center;
}
@media (min-width: 768px) { .bh-doc-mock { display: flex; } }
.bh-pdf-page {
  width: 100%; aspect-ratio: 3/4; background: var(--surface, #fff);
  border: 1px solid var(--border-default); border-radius: 8px;
  padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex; flex-direction: column; gap: 6px;
}
.bh-pdf-line { height: 6px; background: var(--border-default); border-radius: 4px; }
.bh-doc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.bh-tag {
  padding: 2px 12px; border-radius: 100px; font-size: 10px; font-weight: 700;
  background: var(--border-default); color: var(--text-secondary);
  letter-spacing: 0.03em;
}
.bh-doc-analytics { display: flex; align-items: center; gap: 18px; }
.bh-ring {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid var(--bh-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 800; color: var(--bh-accent);
}
.bh-ring-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-top: 2px; }
.bh-analytics-btn {
  background: var(--bh-navy); color: #fff; border: none;
  padding: 8px 18px; border-radius: 100px; font-size: 13px;
  font-weight: 700; font-family: inherit; cursor: pointer;
  transition: transform 0.2s; box-shadow: 0 4px 12px rgba(11,26,46,0.2);
}
.bh-analytics-btn:hover { transform: scale(1.03); }

/* ── Badges ── */
.bh-badge {
  padding: 3px 12px; border-radius: 100px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 4px;
}
.bh-badge i { font-size: 13px; }
.bh-b-video   { background: rgba(79,70,229,0.1);  color: #4f46e5; }
.bh-b-audio   { background: rgba(219,39,119,0.1); color: #db2777; }
.bh-b-text    { background: rgba(5,150,105,0.1);  color: #059669; }
.bh-b-doc     { background: rgba(217,119,6,0.1);  color: #d97706; }
.bh-b-image   { background: rgba(14,165,233,0.1); color: #0ea5e9; }
.bh-status {
  padding: 3px 10px; border-radius: 100px; font-size: 10px;
  font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; flex-shrink: 0;
}
.bh-s-sent    { background: rgba(5,150,105,0.1);  color: #059669; }
.bh-s-draft   { background: rgba(245,158,11,0.1); color: #d97706; }
.bh-s-sched   { background: rgba(79,70,229,0.1);  color: #4f46e5; }

/* ── Load More ── */
.bh-load-wrap { display: flex; flex-direction: column; align-items: center; margin-top: 44px; gap: 12px; }
.bh-load-btn {
  display: flex; align-items: center; gap: 8px; padding: 12px 32px;
  border: 2px solid var(--border-default); border-radius: 100px;
  background: transparent; color: var(--text-primary);
  font-size: 14px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: all 0.25s;
}
.bh-load-btn:hover { background: var(--text-primary); color: var(--bg-card); }
.bh-load-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.bh-load-btn i { transition: transform 0.4s; font-size: 20px; }
.bh-load-btn:hover i { transform: rotate(180deg); }
.bh-status-text { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

/* ── Animations ── */
@keyframes bhFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0);    }
}
.bh-animate { animation: bhFadeUp 0.48s ease forwards; }
.bh-animate:nth-child(2) { animation-delay: 0.05s; }
.bh-animate:nth-child(3) { animation-delay: 0.10s; }
.bh-animate:nth-child(4) { animation-delay: 0.15s; }

/* ── Modal Overlay ── */
.bh-modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.52); backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px; opacity: 0; pointer-events: none;
  transition: opacity 0.35s ease;
}
.bh-modal-overlay.open { opacity: 1; pointer-events: auto; }
.bh-modal {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius); max-width: 880px; width: 100%;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 40px 80px rgba(0,0,0,0.28);
  transform: scale(0.94) translateY(24px);
  transition: transform 0.38s cubic-bezier(0.34,1.56,0.64,1);
}
.bh-modal-overlay.open .bh-modal { transform: scale(1) translateY(0); }
.bh-modal::-webkit-scrollbar { width: 4px; }
.bh-modal::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 10px; }
.bh-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 26px; border-bottom: 1px solid var(--border-default);
  position: sticky; top: 0; background: var(--bg-card); z-index: 2;
  border-radius: var(--bh-radius) var(--bh-radius) 0 0;
}
.bh-modal-back {
  display: flex; align-items: center; gap: 6px; background: none; border: none;
  color: var(--text-secondary); font-size: 14px; font-weight: 500;
  cursor: pointer; font-family: inherit; transition: color 0.2s;
}
.bh-modal-back:hover { color: var(--text-primary); }
.bh-modal-close {
  width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border-default);
  background: transparent; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
}
.bh-modal-close:hover { background: var(--border-default); color: var(--text-primary); }
.bh-modal-body { padding: 26px; }
.bh-modal-meta { margin-bottom: 20px; }
.bh-modal-meta-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.bh-modal-title { font-size: clamp(20px, 3vw, 28px); font-weight: 900; color: var(--text-primary); margin: 0 0 4px 0; }
.bh-modal-by { font-size: 13px; color: var(--text-secondary); margin: 0 0 2px 0; }
.bh-modal-to { font-size: 13px; color: var(--text-secondary); margin: 0; }

/* Modal: Video player */
.bh-video-player {
  background: var(--bh-navy); border-radius: var(--bh-radius-sm);
  aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden; margin-bottom: 20px;
}
.bh-video-player img {
  width: 100%; height: 100%; object-fit: cover; opacity: 0.65;
}
.bh-video-play {
  position: absolute; width: 68px; height: 68px;
  background: rgba(245,166,35,0.9); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 0.2s;
  box-shadow: 0 8px 24px rgba(245,166,35,0.35);
}
.bh-video-play:hover { transform: scale(1.06); }
.bh-video-play i { font-size: 38px; color: #fff; }

/* Modal: Audio player */
.bh-audio-player {
  background: var(--bg-page, var(--bg-card)); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius-sm); padding: 20px 22px; margin-bottom: 20px;
}
.bh-ap-track-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.bh-ap-time { font-size: 12px; font-weight: 600; color: var(--text-secondary); min-width: 38px; }
.bh-ap-track {
  flex: 1; height: 4px; background: var(--border-default);
  border-radius: 4px; position: relative; cursor: pointer;
}
.bh-ap-fill {
  height: 100%; background: linear-gradient(90deg, var(--bh-accent), #f7c948);
  border-radius: 4px; width: 40%;
}
.bh-ap-controls { display: flex; align-items: center; justify-content: space-between; }
.bh-ap-btns { display: flex; align-items: center; gap: 18px; }
.bh-ap-btns button {
  background: none; border: none; color: var(--text-primary);
  cursor: pointer; display: flex; align-items: center; transition: color 0.2s;
  font-size: 26px;
}
.bh-ap-btns button:hover { color: var(--bh-accent); }
.bh-ap-play {
  width: 46px; height: 46px; border-radius: 50%; background: var(--bh-accent) !important;
  color: #fff !important; justify-content: center;
  box-shadow: 0 4px 12px rgba(245,166,35,0.3); transition: transform 0.2s !important;
}
.bh-ap-play:hover { transform: scale(1.05) !important; background: var(--bh-accent-dark) !important; }
.bh-ap-speed {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  background: var(--border-default); border: none; border-radius: 100px;
  padding: 4px 10px; cursor: pointer; font-family: inherit;
}
.bh-ap-stats { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); }
.bh-ap-stats span b { color: var(--text-primary); }

/* Modal: Text content */
.bh-text-content {
  font-size: 14px; line-height: 1.75; color: var(--text-primary);
  background: var(--bg-page, var(--bg-card)); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius-sm); padding: 22px;
  max-height: 360px; overflow-y: auto; margin-bottom: 16px;
  white-space: pre-line;
}

/* Modal: Document preview */
.bh-doc-preview {
  background: var(--bg-page, var(--bg-card)); border: 1px solid var(--border-default);
  border-radius: var(--bh-radius-sm); padding: 22px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  margin-bottom: 16px;
}
.bh-doc-preview .bh-pdf-page { max-width: 260px; }
.bh-dl-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--bh-accent); color: #fff; border: none;
  padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: background 0.2s;
}
.bh-dl-btn:hover { background: var(--bh-accent-dark); }
.bh-dl-btn i { font-size: 20px; }

/* Modal: stats row */
.bh-modal-stats-row { display: flex; flex-wrap: wrap; gap: 20px; font-size: 14px; color: var(--text-secondary); margin-top: 14px; }
.bh-modal-stats-row b { color: var(--text-primary); }

/* Modal: footer */
.bh-modal-footer {
  display: flex; flex-wrap: wrap; align-items: center;
  justify-content: space-between; gap: 12px;
  padding: 18px 26px; border-top: 1px solid var(--border-default);
}
.bh-modal-footer-stats { display: flex; gap: 20px; }
.bh-modal-footer-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.bh-modal-footer-stat b { font-weight: 700; color: var(--text-primary); }
.bh-modal-footer-actions { display: flex; gap: 10px; }
.bh-mf-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: all 0.2s;
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary);
}
.bh-mf-btn:hover { background: var(--border-default); color: var(--text-primary); }
.bh-mf-btn.primary { background: var(--bh-accent); border-color: var(--bh-accent); color: #fff; }
.bh-mf-btn.primary:hover { background: var(--bh-accent-dark); }
.bh-mf-btn i { font-size: 17px; }

/* ── Empty / No results ── */
.bh-empty {
  grid-column: span 12; text-align: center; padding: 56px 20px;
  color: var(--text-secondary);
}
.bh-empty i { font-size: 48px; opacity: 0.3; display: block; margin-bottom: 12px; }
.bh-empty p { font-size: 15px; font-weight: 500; }
`

// ─── CSS injection ──────────────────────────────────────────────────────────
let _cssInjected = false
function _inject() {
  if (_cssInjected) return
  _cssInjected = true
  const s = document.createElement('style')
  s.textContent = BH_CSS
  document.head.appendChild(s)
}

const PAGE_SIZE = 12

// ─── Helpers ───────────────────────────────────────────────────────────────
function _statusClass(status: string): string {
  if (status === 'sent')      return 'bh-s-sent'
  if (status === 'draft')     return 'bh-s-draft'
  if (status === 'scheduled') return 'bh-s-sched'
  return 'bh-s-sent'
}

function _badgeClass(t: ArchiveType): string {
  return { video: 'bh-b-video', audio: 'bh-b-audio', text: 'bh-b-text', document: 'bh-b-doc', image: 'bh-b-image' as any }[t]
}

function _badgeIcon(t: ArchiveType): string {
  return { video: 'bi-camera-video-fill', audio: 'bi-mic-fill', text: 'bi-chat-text-fill', document: 'bi-file-earmark-text-fill', image: 'bi-image-fill' as any }[t]
}

function _badgeLabel(t: ArchiveType): string {
  return { video: 'Video', audio: 'Audio', text: 'Text', document: 'Document', image: 'Image' as any }[t]
}

function _n(v: number | null | undefined): string {
  if (!v) return '0'
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return v.toLocaleString()
}

// ─── Tab class ─────────────────────────────────────────────────────────────
export class BroadcastHistoryTab implements WorkspaceTab {
  readonly id         = 'history'
  readonly label      = 'All Broadcasts'
  readonly icon       = 'clock-history'
  readonly permission = 'communications.reports.view'

  private _container!: HTMLElement
  private _campaigns:  Campaign[] = []
  private _filtered:   Campaign[] = []
  private _visible  = PAGE_SIZE
  private _state    = { s: '', t: 'all' as ArchiveType | 'all' }
  private _sub: any
  private _modalEl: HTMLElement | null = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async render(container: HTMLElement): Promise<void> {
    _inject()
    this._container = container
    container.innerHTML = `<div style="padding:80px;text-align:center;"><span class="cw-spinner"></span></div>`

    const aid = getActiveAssemblyId()
    if (!aid) return
    try {
      this._campaigns = await CommunicationService.getCampaigns(aid)
    } catch { return }

    this._filter()
    this._renderAll()

    this._sub = () => this._reload()
    on('communication:campaign_mutated', this._sub)
  }

  destroy(): void {
    if (this._sub) off('communication:campaign_mutated', this._sub)
    this._closeModal()
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  private async _reload() {
    const aid = getActiveAssemblyId()
    if (!aid) return
    try {
      this._campaigns = await CommunicationService.getCampaigns(aid)
    } catch { return }
    this._filter()
    this._renderAll()
  }

  private _filter() {
    const q = this._state.s.toLowerCase()
    this._filtered = this._campaigns.filter(c => {
      const mq = !q || c.title.toLowerCase().includes(q) || (c.body ?? '').toLowerCase().includes(q)
      const mt = this._state.t === 'all' || _archiveType(c) === this._state.t
      return mq && mt
    })
    this._visible = PAGE_SIZE
  }

  // ── Full render ───────────────────────────────────────────────────────────
  private _renderAll() {
    console.log('[DEBUG] Campaigns:', this._campaigns)
    const total = this._campaigns.length
    const sent  = this._campaigns.filter(c => c.status === 'sent').length
    const views = this._campaigns.reduce((a, c) => a + (c.total_recipients ?? 0), 0)
    const vids  = this._campaigns.filter(c => _archiveType(c) === 'video').length

    this._container.innerHTML = `
      <div class="ss-bh bh-history">

        <!-- Header -->
        <div class="bh-header">
          <div>
            <div class="bh-breadcrumb">
              <span>Dashboard</span>
              <span class="sep">›</span>
              <span class="cur">Broadcast History</span>
            </div>
            <h1 class="bh-title">Broadcast History</h1>
            <p class="bh-subtitle">
              Track and analyze your ministry's digital outreach. Monitor engagement
              across video sermons, audio recaps, and community announcements.
            </p>
          </div>
          <div class="bh-header-right">
            <div class="bh-search-wrap">
              <i class="bi bi-search"></i>
              <input type="text" id="bh-search" placeholder="Search broadcasts…" autocomplete="off" />
              <span class="bh-search-hint">⌘K</span>
            </div>
            <button class="bh-icon-btn" title="Filter" aria-label="Filter">
              <i class="bi bi-funnel" style="font-size:18px;"></i>
            </button>
            <button class="bh-icon-btn" title="Date range" aria-label="Date range">
              <i class="bi bi-calendar3" style="font-size:18px;"></i>
            </button>
            <button class="bh-new-btn" id="bh-new">
              <i class="bi bi-plus-lg"></i> New Broadcast
            </button>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="bh-filters" id="bh-chips">
          <button class="bh-chip" data-t="all">All</button>
          <button class="bh-chip" data-t="video">Video</button>
          <button class="bh-chip" data-t="audio">Audio</button>
          <button class="bh-chip" data-t="text">Text</button>
          <button class="bh-chip" data-t="document">Document</button>
          <button class="bh-chip-reset" id="bh-reset">
            <i class="bi bi-arrow-clockwise"></i> Reset filters
          </button>
        </div>

        <!-- Stats -->
        <div class="bh-stats">
          <div class="bh-stat">
            <div class="bh-stat-row">
              <span class="bh-stat-label">Total Broadcasts</span>
              <span class="bh-stat-badge green">+12%</span>
            </div>
            <div class="bh-stat-val">${total}</div>
            <div class="bh-mini-chart">
              <div class="bar hi" style="height:24px"></div>
              <div class="bar"    style="height:14px"></div>
              <div class="bar hi" style="height:28px"></div>
              <div class="bar"    style="height:18px"></div>
              <div class="bar hi" style="height:32px"></div>
              <div class="bar"    style="height:12px"></div>
              <div class="bar hi" style="height:22px"></div>
              <div class="bar"    style="height:16px"></div>
            </div>
          </div>
          <div class="bh-stat">
            <div class="bh-stat-row">
              <span class="bh-stat-label">Total Recipients</span>
              <span class="bh-stat-badge green">+8.3%</span>
            </div>
            <div class="bh-stat-val">${_n(views)}</div>
            <div class="bh-mini-chart">
              <div class="bar hi" style="height:20px"></div>
              <div class="bar"    style="height:10px"></div>
              <div class="bar hi" style="height:30px"></div>
              <div class="bar"    style="height:16px"></div>
              <div class="bar hi" style="height:26px"></div>
              <div class="bar"    style="height: 8px"></div>
              <div class="bar hi" style="height:34px"></div>
              <div class="bar"    style="height:14px"></div>
            </div>
          </div>
          <div class="bh-stat">
            <div class="bh-stat-row">
              <span class="bh-stat-label">Sent Rate</span>
              <span class="bh-stat-badge amber">+2.1%</span>
            </div>
            <div class="bh-stat-val">${total ? Math.round((sent / total) * 100) : 0}%</div>
            <div class="bh-progress-thin">
              <div class="bh-progress-thin-fill" style="width:${total ? Math.round((sent / total) * 100) : 0}%"></div>
            </div>
          </div>
          <div class="bh-stat">
            <div class="bh-stat-row">
              <span class="bh-stat-label">Video Broadcasts</span>
              <span class="bh-stat-badge green">+18%</span>
            </div>
            <div class="bh-stat-val">${vids}</div>
            <div class="bh-stat-footnote">
              <i class="bi bi-graph-up-arrow"></i>
              <span>${sent} sent this period</span>
            </div>
          </div>
        </div>

        <!-- Grid -->
        <div class="bh-grid" id="bh-grid"></div>

        <!-- Load more -->
        <div class="bh-load-wrap" id="bh-load"></div>
      </div>
    `

    // Wire up chips
    this._container.querySelectorAll<HTMLButtonElement>('.bh-chip').forEach(c => {
      c.classList.toggle('active', c.dataset['t'] === this._state.t)
      c.addEventListener('click', () => {
        this._state.t = c.dataset['t'] as any
        this._filter()
        this._renderAll()
      })
    })

    // Wire up reset
    this._container.querySelector('#bh-reset')?.addEventListener('click', () => {
      this._state = { s: '', t: 'all' }
      this._filter()
      this._renderAll()
    })

    // Wire up new broadcast
    this._container.querySelector('#bh-new')?.addEventListener('click', () => {
      navigate('/communications/campaigns/new')
    })

    // Wire up search
    const inp = this._container.querySelector<HTMLInputElement>('#bh-search')!
    inp.value = this._state.s
    inp.addEventListener('input', () => {
      this._state.s = inp.value
      this._filter()
      this._renderGrid()
    })

    // Cmd+K shortcut
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inp.focus() }
      if (e.key === 'Escape' && document.activeElement === inp) inp.blur()
    }
    document.addEventListener('keydown', onKeyDown)

    this._renderGrid()
  }

  // ── Grid render ───────────────────────────────────────────────────────────
  private _renderGrid() {
    const grid = this._container.querySelector('#bh-grid')!
    const load = this._container.querySelector('#bh-load')!
    const vis  = this._filtered.slice(0, this._visible)

    if (!vis.length) {
      grid.innerHTML = `
        <div class="bh-empty">
          <i class="bi bi-broadcast"></i>
          <p>No broadcasts found.</p>
        </div>`
      load.innerHTML = ''
      return
    }

    grid.innerHTML = vis.map(c => this._cardHtml(c)).join('')

    // Animate progress bars in on scroll
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll<HTMLElement>('.bh-progress-fill').forEach(f => {
            const w = f.dataset['w'] || '0%'
            f.style.width = '0%'
            setTimeout(() => { f.style.width = w }, 150)
          })
        }
      })
    }, { threshold: 0.2 })
    grid.querySelectorAll<HTMLElement>('.bh-card').forEach(c => observer.observe(c))

    // Card click → modal
    grid.querySelectorAll<HTMLElement>('.bh-card').forEach(el => {
      el.addEventListener('click', () => {
        const c = this._campaigns.find(x => x.id === el.dataset['id'])
        if (c) this._openModal(c)
      })
    })

    // Load more
    const remaining = this._filtered.length - this._visible
    if (remaining > 0) {
      load.innerHTML = `
        <button class="bh-load-btn" id="bh-more">
          <i class="bi bi-chevron-down"></i>
          Load Previous Archives
        </button>
        <p class="bh-status-text" id="bh-status">Showing ${vis.length} of ${this._filtered.length} broadcasts</p>
      `
      load.querySelector('#bh-more')?.addEventListener('click', () => {
        this._visible += PAGE_SIZE
        this._renderGrid()
      })
    } else {
      load.innerHTML = `
        <button class="bh-load-btn" disabled>
          <i class="bi bi-check-circle"></i> All archives loaded
        </button>
        <p class="bh-status-text">Showing all ${this._filtered.length} broadcasts</p>
      `
    }
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────
  private _cardHtml(c: Campaign): string {
    const t   = _archiveType(c)
    const aud = c.audience_type === 'assembly' ? 'All Members' : (c.audience_type ?? 'Members')
    const dt  = _fmt(c.created_at)
    const rc  = _n(c.total_recipients)
    const st  = c.status ?? 'sent'

    if (t === 'video') return this._videoCard(c, aud, dt, rc, st)
    if (t === 'audio') return this._audioCard(c, aud, dt, rc, st)
    if (t === 'text')  return this._textCard(c, aud, dt, rc, st)
    return this._docCard(c, aud, dt, rc, st)
  }

  private _videoCard(c: Campaign, aud: string, dt: string, rc: string, st: string): string {
    return `
      <article class="bh-card bh-col-8 bh-c-video bh-animate" data-id="${c.id}">
        <div class="bh-thumb">
          <img src="${defaultImage}" alt="${c.title}" loading="lazy" />
          <div class="bh-thumb-gradient"></div>
          <div class="bh-thumb-overlay"><i class="bi bi-play-circle-fill"></i></div>
          <div class="bh-thumb-badge">
            <span class="bh-badge bh-b-video">
              <i class="bi bi-camera-video-fill"></i> Video
            </span>
          </div>
        </div>
        <div class="bh-card-body">
          <div class="bh-card-top">
            <div>
              <div class="bh-to">To: ${aud}</div>
              <h3 class="bh-card-title">${c.title}</h3>
            </div>
            <span class="bh-status ${_statusClass(st)}">${st}</span>
          </div>
          <p class="bh-card-desc">${c.body || 'No description provided.'}</p>
          <div class="bh-card-footer">
            <div class="bh-stat-inline">
              <div>
                <span class="bh-stat-num">${rc}</span>
                <span class="bh-stat-lbl">Recipients</span>
              </div>
            </div>
            <span class="bh-date-lbl">${dt}</span>
          </div>
        </div>
      </article>
    `
  }

  private _audioCard(c: Campaign, aud: string, dt: string, rc: string, st: string): string {
    return `
      <article class="bh-card bh-col-4 bh-animate" data-id="${c.id}">
        <div class="bh-c-audio">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <div class="bh-icon-box bh-icon-audio"><i class="bi bi-mic-fill"></i></div>
            <span class="bh-date-lbl">${dt}</span>
          </div>
          <div class="bh-to">To: ${aud}</div>
          <h3 class="bh-card-title">${c.title}</h3>
          <p class="bh-card-desc">${c.body || 'Audio broadcast.'}</p>
          <div style="margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-bottom:6px;">
              <span>Progress</span>
              <span style="color:var(--bh-accent); font-weight:700;">78%</span>
            </div>
            <div class="bh-progress-bar">
              <div class="bh-progress-fill" data-w="78%" style="width:0%"></div>
            </div>
          </div>
          <div class="bh-card-footer" style="padding-top:12px;">
            <div class="bh-audio-stats">
              <span><i class="bi bi-download"></i> ${rc}</span>
              <span><i class="bi bi-headphones"></i> ${rc}</span>
            </div>
            <button class="bh-details-btn">
              Details <i class="bi bi-arrow-right"></i>
            </button>
          </div>
        </div>
      </article>
    `
  }

  private _textCard(c: Campaign, aud: string, dt: string, rc: string, st: string): string {
    return `
      <article class="bh-card bh-col-4 bh-animate" data-id="${c.id}">
        <div class="bh-c-text">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <div class="bh-icon-box bh-icon-text"><i class="bi bi-chat-text-fill"></i></div>
            <span class="bh-date-lbl">${dt}</span>
          </div>
          <div class="bh-to">To: ${aud}</div>
          <h3 class="bh-card-title">${c.title}</h3>
          <p class="bh-card-desc">"${c.body || 'Text broadcast.'}"</p>
          <div class="bh-card-footer" style="padding-top:12px;">
            <div class="bh-stat-inline">
              <div>
                <span class="bh-stat-num">${rc}</span>
                <span class="bh-stat-lbl">Recipients</span>
              </div>
            </div>
            <button class="bh-receipt-btn">View Receipt</button>
          </div>
        </div>
      </article>
    `
  }

  private _docCard(c: Campaign, aud: string, dt: string, rc: string, st: string): string {
    return `
      <article class="bh-card bh-col-8 bh-animate" data-id="${c.id}">
        <div class="bh-c-doc">
          <div class="bh-doc-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <span class="bh-badge bh-b-doc">
                <i class="bi bi-file-earmark-text-fill"></i> Document
              </span>
              <span class="bh-date-lbl">${dt}</span>
            </div>
            <h3 class="bh-card-title">${c.title}</h3>
            <p class="bh-card-desc">${c.body || 'No description provided.'}</p>
            <div class="bh-doc-tags">
              <span class="bh-tag">#Community</span>
              <span class="bh-tag">#Outreach</span>
              <span class="bh-tag">#Report</span>
            </div>
            <div class="bh-card-footer" style="padding-top:14px;">
              <div class="bh-doc-analytics">
                <div style="text-align:center;">
                  <div class="bh-ring">98%</div>
                  <div class="bh-ring-label">Open Rate</div>
                </div>
                <div style="text-align:center;">
                  <div class="bh-ring">${rc}</div>
                  <div class="bh-ring-label">Recipients</div>
                </div>
              </div>
              <button class="bh-analytics-btn">Full Analytics</button>
            </div>
          </div>
          <div class="bh-doc-mock">
            <div class="bh-pdf-page">
              <div class="bh-pdf-line" style="width:40%"></div>
              <div class="bh-pdf-line" style="width:70%"></div>
              <div class="bh-pdf-line" style="width:100%"></div>
              <div class="bh-pdf-line" style="width:100%; height:36px; margin:8px 0;"></div>
              <div class="bh-pdf-line" style="width:80%"></div>
              <div class="bh-pdf-line" style="width:60%"></div>
            </div>
          </div>
        </div>
      </article>
    `
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  private _openModal(c: Campaign) {
    const t   = _archiveType(c)
    const dt  = _fmt(c.created_at)
    const rc  = _n(c.total_recipients)
    const st  = c.status ?? 'sent'

    const typeMedia = this._modalTypeMedia(c, t)

    const html = `
      <div class="bh-modal-overlay" id="bh-modal-overlay">
        <div class="bh-modal" role="dialog" aria-modal="true">
          <div class="bh-modal-header">
            <button class="bh-modal-back" id="bh-modal-back">
              <i class="bi bi-arrow-left" style="font-size:18px;"></i> Back
            </button>
            <button class="bh-modal-close" id="bh-modal-close" aria-label="Close">
              <i class="bi bi-x-lg" style="font-size:18px;"></i>
            </button>
          </div>

          <div class="bh-modal-body">
            <!-- Meta -->
            <div class="bh-modal-meta">
              <div class="bh-modal-meta-row">
                <span class="bh-badge ${_badgeClass(t)}">
                  <i class="bi ${_badgeIcon(t)}"></i> ${_badgeLabel(t)}
                </span>
                <span class="bh-status ${_statusClass(st)}">${st}</span>
                <span style="font-size:12px; color:var(--text-secondary);">${dt}</span>
              </div>
              <h2 class="bh-modal-title">${c.title}</h2>
              <p class="bh-modal-to">To: ${c.audience_type === 'assembly' ? 'All Members' : (c.audience_type ?? 'Members')}</p>
            </div>

            <!-- Type-specific media -->
            ${typeMedia}
          </div>

          <div class="bh-modal-footer">
            <div class="bh-modal-footer-stats">
              <div class="bh-modal-footer-stat"><b>${rc}</b> Recipients</div>
              <div class="bh-modal-footer-stat"><b>${dt}</b></div>
            </div>
            <div class="bh-modal-footer-actions">
              <button class="bh-mf-btn primary">
                <i class="bi bi-bookmark"></i> Save
              </button>
              <button class="bh-mf-btn">
                <i class="bi bi-share"></i> Share
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    // Remove any existing modal
    this._closeModal()

    document.body.insertAdjacentHTML('beforeend', html)
    this._modalEl = document.getElementById('bh-modal-overlay')
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      this._modalEl?.classList.add('open')
    })

    // Close listeners
    const close = () => this._closeModal()
    document.getElementById('bh-modal-close')?.addEventListener('click', close)
    document.getElementById('bh-modal-back')?.addEventListener('click', close)
    this._modalEl?.addEventListener('click', e => { if (e.target === this._modalEl) close() })

    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc) } }
    document.addEventListener('keydown', onEsc)

    // Audio play/pause toggle
    const playBtn = this._modalEl?.querySelector<HTMLButtonElement>('#bh-ap-play')
    playBtn?.addEventListener('click', () => {
      const icon = playBtn.querySelector('i')
      if (!icon) return
      icon.classList.toggle('bi-play-arrow')
      icon.classList.toggle('bi-pause-fill')
    })

    // Video play toggle
    const videoPlay = this._modalEl?.querySelector<HTMLElement>('.bh-video-play')
    videoPlay?.addEventListener('click', () => {
      const icon = videoPlay.querySelector('i')
      if (icon) { icon.className = 'bi bi-pause-circle-fill'; icon.style.fontSize = '38px' }
      const img = this._modalEl?.querySelector<HTMLImageElement>('.bh-video-player img')
      if (img) img.style.opacity = '0.35'
    })
  }

  private _modalTypeMedia(c: Campaign, t: ArchiveType): string {
    const desc = c.body || 'No description available.'
    const rc   = _n(c.total_recipients)

    if (t === 'video') {
      return `
        <div class="bh-video-player">
          <img src="${defaultImage}" alt="${c.title}" />
          <div class="bh-video-play">
            <i class="bi bi-play-fill" style="font-size:38px; color:#fff;"></i>
          </div>
        </div>
        <p style="font-size:14px; color:var(--text-secondary); line-height:1.7; margin-bottom:14px;">${desc}</p>
        <div class="bh-modal-stats-row">
          <div><b>${rc}</b> Recipients</div>
        </div>
      `
    }

    if (t === 'audio') {
      return `
        <p style="font-size:14px; color:var(--text-secondary); line-height:1.7; margin-bottom:20px;">${desc}</p>
        <div class="bh-audio-player">
          <div class="bh-ap-track-row">
            <span class="bh-ap-time">12:45</span>
            <div class="bh-ap-track">
              <div class="bh-ap-fill"></div>
            </div>
            <span class="bh-ap-time">16:20</span>
          </div>
          <div class="bh-ap-controls">
            <div class="bh-ap-btns">
              <button id="bh-ap-play" class="bh-ap-play" aria-label="Play/Pause">
                <i class="bi bi-play-arrow" style="font-size:26px; color:#fff;"></i>
              </button>
              <button aria-label="Skip back"><i class="bi bi-skip-backward-fill"></i></button>
              <button aria-label="Skip forward"><i class="bi bi-skip-forward-fill"></i></button>
              <select class="bh-ap-speed" aria-label="Playback speed">
                <option>0.5x</option><option>0.75x</option>
                <option selected>1.0x</option>
                <option>1.25x</option><option>1.5x</option><option>2.0x</option>
              </select>
            </div>
            <div class="bh-ap-stats">
              <span><b>${rc}</b> Listens</span>
              <span><b>${rc}</b> Downloads</span>
            </div>
          </div>
        </div>
      `
    }

    if (t === 'text') {
      return `
        <div class="bh-text-content">${desc}</div>
        <div class="bh-modal-stats-row">
          <div><b>${rc}</b> Recipients</div>
        </div>
      `
    }

    // document
    return `
      <p style="font-size:14px; color:var(--text-secondary); line-height:1.7; margin-bottom:20px;">${desc}</p>
      <div class="bh-doc-preview">
        <div class="bh-pdf-page" style="max-width:240px;">
          <div class="bh-pdf-line" style="width:40%"></div>
          <div class="bh-pdf-line" style="width:70%"></div>
          <div class="bh-pdf-line"></div>
          <div class="bh-pdf-line" style="height:36px; margin:8px 0;"></div>
          <div class="bh-pdf-line" style="width:80%"></div>
          <div class="bh-pdf-line" style="width:55%"></div>
        </div>
        <button class="bh-dl-btn">
          <i class="bi bi-download"></i>
          Download Document
        </button>
      </div>
      <div class="bh-modal-stats-row">
        <div><b>${rc}</b> Downloads</div>
        <div><b>98%</b> Open Rate</div>
      </div>
    `
  }

  private _closeModal() {
    if (!this._modalEl) return
    this._modalEl.classList.remove('open')
    document.body.style.overflow = ''
    setTimeout(() => {
      this._modalEl?.remove()
      this._modalEl = null
    }, 380)
  }
}