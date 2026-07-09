// vessel-search.js — Vessel search & tracking UI

import { aisClient } from './ais.js?v=3';

class VesselSearch {
    constructor() {
        this.searchInput = null;
        this.resultsDropdown = null;
        this.trackedPanel = null;
        this.searchTimeout = null;
        this.onSelectVessel = null; // callback(vessel)
        this.activeResults = [];
        this.resultIndex = -1;
    }

    init() {
        this.searchInput = document.getElementById('vessel-search-input');
        this.resultsDropdown = document.getElementById('vessel-search-results');
        this.trackedPanel = document.getElementById('vessel-tracked-panel');

        if (!this.searchInput) return;

        // Search input handler with debounce
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.performSearch(), 250);
        });

        // Clear results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#vessel-search-bar')) {
                this.hideResults();
            }
        });

        // Focus the search bar
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim().length > 0) {
                this.showResults();
            }
        });

        // Keyboard navigation in results
        this.searchInput.addEventListener('keydown', (e) => this.handleSearchKey(e));

        // Prevent mode-switching keys when typing in search
        this.searchInput.addEventListener('keydown', (e) => {
            // Allow mode/map keys to pass through to global handler
            const modeKeys = ['m', 'M', '1', 't', 'T', 'x', 'X', 'q', 'Q', 'w', 'W', 'v', 'V', 'Escape'];
            if (modeKeys.includes(e.key)) {
                // Blur input and let the global handler pick it up
                this.searchInput.blur();
                return; // Don't stop propagation
            }
            e.stopPropagation();
        });
    }

    handleSearchKey(e) {
        if (this.activeResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.resultIndex = Math.min(this.resultIndex + 1, this.activeResults.length - 1);
                this.renderResults();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.resultIndex = Math.max(this.resultIndex - 1, 0);
                this.renderResults();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.resultIndex >= 0 && this.resultIndex < this.activeResults.length) {
                    this.selectVessel(this.activeResults[this.resultIndex]);
                }
                break;
            case 'Escape':
                this.hideResults();
                this.searchInput.blur();
                break;
        }
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (query.length === 0) {
            this.activeResults = [];
            this.hideResults();
            return;
        }

        const results = await aisClient.searchVessels(query);
        this.activeResults = results;
        this.resultIndex = -1;
        this.showResults();
    }

    showResults() {
        if (this.activeResults.length === 0 && this.searchInput.value.trim().length > 0) {
            this.resultsDropdown.innerHTML = '<div class="vessel-search-empty">NO VESSELS FOUND</div>';
        } else {
            this.renderResults();
        }
        this.resultsDropdown.classList.add('open');
    }

    hideResults() {
        this.resultsDropdown.classList.remove('open');
    }

    renderResults() {
        if (this.activeResults.length === 0) {
            this.resultsDropdown.innerHTML = '';
            return;
        }

        const html = this.activeResults.map((v, i) => {
            const cls = i === this.resultIndex ? 'vessel-result-row selected' : 'vessel-result-row';
            const tracked = aisClient.isTracked(v.mmsi) ? '<span class="vessel-tracked-tag">●TRACKED</span>' : '';
            const name = v.name || 'UNKNOWN';
            const speed = v.sog != null ? `${v.sog.toFixed(1)}kn` : '--';
            const heading = v.heading != null ? `${Math.round(v.heading)}°` : '--';
            return `
                <div class="${cls}" data-mmsi="${v.mmsi}" data-index="${i}">
                    <div class="vessel-result-main">
                        <span class="vessel-result-name">${this.escape(name)}</span>
                        ${tracked}
                    </div>
                    <div class="vessel-result-meta">
                        <span>MMSI:${v.mmsi}</span>
                        <span>${v.callsign || '---'}</span>
                        <span>${speed}</span>
                        <span>HDG:${heading}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.resultsDropdown.innerHTML = html;

        // Bind click events
        this.resultsDropdown.querySelectorAll('.vessel-result-row').forEach(row => {
            row.addEventListener('click', () => {
                const mmsi = Number(row.dataset.mmsi);
                const vessel = this.activeResults[Number(row.dataset.index)];
                this.selectVessel(vessel);
            });
        });
    }

    async selectVessel(vessel) {
        if (!vessel) return;

        // Track the vessel
        await aisClient.trackVessel(vessel.mmsi);

        // Select it
        aisClient.selectVessel(vessel.mmsi);

        // Hide results
        this.hideResults();

        // Clear search input
        this.searchInput.value = '';

        // Trigger callback (fly to map, open detail)
        if (this.onSelectVessel) {
            this.onSelectVessel(vessel);
        }

        // Refresh tracked panel
        this.renderTrackedPanel();
    }

    renderTrackedPanel() {
        if (!this.trackedPanel) return;

        const tracked = aisClient.getTrackedVessels();

        if (tracked.length === 0) {
            this.trackedPanel.innerHTML = '<div class="tracked-empty">NO VESSELS TRACKED</div>';
            return;
        }

        const html = tracked.map(v => {
            const isSelected = aisClient.selectedMMSI === v.mmsi;
            const cls = isSelected ? 'tracked-vessel-row selected' : 'tracked-vessel-row';
            const name = v.name || 'UNKNOWN';
            const speed = v.sog != null ? `${v.sog.toFixed(1)}kn` : '--';
            const heading = v.heading != null ? `${Math.round(v.heading)}°` : '--';
            const dest = v.destination || '---';
            const eta = v.eta || '---';
            return `
                <div class="${cls}" data-mmsi="${v.mmsi}">
                    <div class="tracked-vessel-main">
                        <span class="tracked-vessel-name">${this.escape(name)}</span>
                        <button class="tracked-vessel-untrack" data-untrack="${v.mmsi}">[✕]</button>
                    </div>
                    <div class="tracked-vessel-meta">
                        <span>MMSI:${v.mmsi}</span>
                        <span>SOG:${speed}</span>
                        <span>HDG:${heading}</span>
                        <span>DEST:${this.escape(dest)}</span>
                        <span>ETA:${eta}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.trackedPanel.innerHTML = html;

        // Bind events
        this.trackedPanel.querySelectorAll('.tracked-vessel-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.dataset.untrack) {
                    e.stopPropagation();
                    const mmsi = Number(e.target.dataset.untrack);
                    aisClient.untrackVessel(mmsi);
                    this.renderTrackedPanel();
                } else {
                    const mmsi = Number(row.dataset.mmsi);
                    const vessel = aisClient.getVessel(mmsi);
                    if (vessel && this.onSelectVessel) {
                        aisClient.selectVessel(mmsi);
                        this.onSelectVessel(vessel);
                    }
                }
            });
        });
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    show() {
        const bar = document.getElementById('vessel-search-bar');
        if (bar) bar.style.display = 'flex';
        const panel = document.getElementById('vessel-tracked-panel');
        if (panel) panel.style.display = 'flex';
        // Refresh tracked panel when entering vessel mode
        this.renderTrackedPanel();
    }

    hide() {
        const bar = document.getElementById('vessel-search-bar');
        if (bar) bar.style.display = 'none';
        const panel = document.getElementById('vessel-tracked-panel');
        if (panel) panel.style.display = 'none';
        this.hideResults();
    }
}

export const vesselSearch = new VesselSearch();