// modes.js — Mode switching controller

const VIEWS = {
    default: 'default-view',
    timeline: 'timeline-view',
    metrics: 'metrics-view',
    minimal: 'minimal-view',
    watchlist: 'watchlist-view',
    focused: 'focused-view',
    vessels: 'vessels-view',
};

import { vesselSearch } from './vessel-search.js?v=4';
import { vesselDetail } from './vessel-detail.js?v=4';

export class ModeController {
    constructor(app) {
        this.app = app;
        this.currentMode = 'default';
        this.bind();
    }

    bind() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });
    }

    setMode(mode) {
        if (!VIEWS[mode]) return;
        this.currentMode = mode;

        // Update view visibility
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const view = document.getElementById(VIEWS[mode]);
        if (view) view.classList.add('active');

        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.app.currentMode = mode;
        this.app.render();

        // Show/hide vessel search bar and tracked panel based on mode
        if (mode === 'vessels') {
            vesselSearch.show();
            // Show tracked panel
            const panel = document.getElementById('vessel-tracked-panel');
            if (panel) panel.classList.add('show');
        } else {
            vesselSearch.hide();
            vesselDetail.close();
            const panel = document.getElementById('vessel-tracked-panel');
            if (panel) panel.classList.remove('show');
        }
    }

    renderTimeline(events, activeFilters) {
        const container = document.getElementById('timeline-list');
        if (!container) return;

        const filtered = events.filter(e => activeFilters.has(e.severity));
        if (filtered.length === 0) {
            container.innerHTML = '<div style="padding:20px;color:var(--amber-dim);">NO EVENTS TO DISPLAY</div>';
            return;
        }

        // Group by hour
        const groups = {};
        for (const ev of filtered) {
            const d = new Date(ev.timestamp);
            const hourKey = d.toISOString().substring(0, 13) + ':00';
            if (!groups[hourKey]) groups[hourKey] = [];
            groups[hourKey].push(ev);
        }

        // Sort by time descending
        const sortedKeys = Object.keys(groups).sort().reverse();

        container.innerHTML = '';
        for (const key of sortedKeys) {
            const group = document.createElement('div');
            group.className = 'timeline-group';

            const d = new Date(key);
            const label = d.toLocaleString('en-US', {
                month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
            });

            group.innerHTML = `<div class="timeline-hour">▶ ${label} — ${groups[key].length} EVENTS</div>`;

            for (const ev of groups[key]) {
                const row = document.createElement('div');
                row.className = `event-row ${ev.severity}`;
                row.innerHTML = `
                    <span class="ev-sev ${ev.severity}"></span>
                    <span class="ev-time">${new Date(ev.timestamp).toLocaleTimeString('en-US',{hour12:false}).substring(0,5)}</span>
                    <span class="ev-title">${ev.title}</span>
                    <span class="ev-source">${ev.source}</span>
                `;
                row.addEventListener('click', () => this.app.openDetail(ev));
                group.appendChild(row);
            }
            container.appendChild(group);
        }
    }

    renderMetrics(events) {
        const container = document.getElementById('metrics-content');
        if (!container) return;

        // Severity distribution
        const sevCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        const feedCounts = { GEO: 0, ENV: 0, MKT: 0, INF: 0 };
        for (const ev of events) {
            if (sevCounts[ev.severity] !== undefined) sevCounts[ev.severity]++;
            if (feedCounts[ev.feed] !== undefined) feedCounts[ev.feed]++;
        }
        const total = events.length || 1;

        let html = '';

        // Severity distribution
        html += '<div class="metric-section">';
        html += '<div class="metric-section-title">SEVERITY DISTRIBUTION</div>';
        for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
            const count = sevCounts[sev];
            const pct = ((count / total) * 100).toFixed(1);
            html += `
                <div class="metric-bar-row">
                    <span class="metric-bar-label">${sev}</span>
                    <div class="metric-bar-track">
                        <div class="metric-bar-fill ${sev}" style="width:${pct}%">${count > 0 ? count : ''}</div>
                    </div>
                    <span class="metric-bar-value">${count} (${pct}%)</span>
                </div>
            `;
        }
        html += '</div>';

        // Feed distribution
        html += '<div class="metric-section">';
        html += '<div class="metric-section-title">FEED DISTRIBUTION</div>';
        const feedColors = { GEO: 'CRITICAL', ENV: 'MEDIUM', MKT: 'MEDIUM', INF: 'HIGH' };
        for (const feed of ['GEO', 'ENV', 'MKT', 'INF']) {
            const count = feedCounts[feed];
            const pct = ((count / total) * 100).toFixed(1);
            html += `
                <div class="metric-bar-row">
                    <span class="metric-bar-label">${feed}</span>
                    <div class="metric-bar-track">
                        <div class="metric-bar-fill ${feedColors[feed]}" style="width:${pct}%">${count > 0 ? count : ''}</div>
                    </div>
                    <span class="metric-bar-value">${count} (${pct}%)</span>
                </div>
            `;
        }
        html += '</div>';

        // Top 5 priority signals (CRITICAL first, then HIGH, sorted by time)
        const priority = events
            .filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH')
            .sort((a, b) => {
                if (a.severity !== b.severity) return a.severity === 'CRITICAL' ? -1 : 1;
                return new Date(b.timestamp) - new Date(a.timestamp);
            })
            .slice(0, 5);

        html += '<div class="metric-section">';
        html += '<div class="metric-section-title">TOP 5 PRIORITY SIGNALS</div>';
        if (priority.length === 0) {
            html += '<div style="color:var(--amber-dim);padding:8px;">NO CRITICAL/HIGH SIGNALS</div>';
        } else {
            priority.forEach((ev, i) => {
                html += `
                    <div class="priority-signal" data-event-id="${ev.id}" style="cursor:pointer;">
                        <span class="priority-rank">${i + 1}.</span>
                        <span class="ev-sev ${ev.severity}"></span>
                        <span class="ev-title" style="color:${ev.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--high)'};flex:1;">${ev.title}</span>
                        <span class="ev-source">${ev.source}</span>
                    </div>
                `;
            });
        }
        html += '</div>';

        container.innerHTML = html;

        // Bind click events on priority signals
        container.querySelectorAll('.priority-signal').forEach(el => {
            el.addEventListener('click', () => {
                const ev = events.find(e => e.id === el.dataset.eventId);
                if (ev) this.app.openDetail(ev);
            });
        });
    }

    renderMinimal(events, mapHtml, blipCount) {
        const mapEl = document.getElementById('minimal-ascii-map');
        if (mapEl) mapEl.innerHTML = mapHtml;

        const countEl = document.getElementById('minimal-signal-count');
        if (countEl) countEl.textContent = `${events.length} SIGNALS`;

        const summaryEl = document.getElementById('minimal-feed-summary');
        if (summaryEl) {
            const counts = { GEO: 0, ENV: 0, MKT: 0, INF: 0 };
            for (const ev of events) counts[ev.feed] = (counts[ev.feed] || 0) + 1;
            summaryEl.innerHTML = `GEO:${counts.GEO} ENV:${counts.ENV} MKT:${counts.MKT} INF:${counts.INF} | ${blipCount} BLIPS`;
        }
    }
}