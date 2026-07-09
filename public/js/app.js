// app.js — Main application controller for Clermont World Situation Monitor

import { api } from './api.js?v=5';
import { renderMapWithBlips, buildAsciiMap, buildAsciiMapFromTopojson } from './map-ascii.js?v=5';
import { openLeafletMap, closeLeafletMap, updateLeafletMap, focusLeafletOnEvent, updateVesselMarkers, focusOnVessel, toggleAllVesselTraffic, isShowingAllTraffic } from './map-leaflet.js?v=5';
import { renderPanels } from './panels.js?v=5';
import { KeyboardController } from './keyboard.js?v=5';
import { FilterController } from './filter.js?v=5';
import { ModeController } from './modes.js?v=5';
import { WatchlistManager } from './watchlist.js?v=5';
import { DetailController, renderFocusedView } from './detail.js?v=5';
import { aisClient } from './ais.js?v=5';
import { vesselSearch } from './vessel-search.js?v=5';
import { vesselDetail } from './vessel-detail.js?v=5';

class ClermontApp {
    constructor() {
        this.allEvents = [];
        this.filteredEvents = [];
        this.selectedEvent = null;
        this.currentMode = 'default';
        this.feedStatuses = {};

        this.filter = new FilterController();
        this.watchlist = new WatchlistManager();
        this.keyboard = new KeyboardController(this);
        this.modes = new ModeController(this);
        this.detail = new DetailController(this);

        this.mapString = null;
        this.lastUpdateTime = null;

        this.bindUI();
        this.initAIS();
        this.start();
    }

    bindUI() {
        // Open leaflet button
        const openBtn = document.getElementById('open-leaflet');
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openLeaflet());
        }

        // Leaflet close button
        const closeBtn = document.getElementById('leaflet-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeLeaflet());
        }

        // Toggle all vessel traffic button
        const trafficBtn = document.getElementById('leaflet-toggle-traffic');
        if (trafficBtn) {
            trafficBtn.addEventListener('click', () => toggleAllVesselTraffic());
        }

        // Feed panel click events
        document.querySelectorAll('.feed-panel').forEach(panel => {
            panel.addEventListener('click', () => {
                document.querySelectorAll('.feed-panel').forEach(p => p.classList.remove('selected'));
                panel.classList.add('selected');
            });
        });

        // Vessel selected from map marker click
        document.addEventListener('clermont:vessel-selected', (e) => {
            this.openVesselDetail(e.detail.mmsi);
        });
    }

    async start() {
        // Build the ASCII map
        try {
            this.mapString = await buildAsciiMapFromTopojson();
        } catch {
            this.mapString = buildAsciiMap();
        }

        // Initial data fetch
        await this.refresh();

        // Start clock
        this.startClock();

        // Auto-refresh every 60 seconds
        setInterval(() => this.refresh(), 60000);
    }

    initAIS() {
        // Initialize vessel search and detail
        vesselSearch.init();
        vesselDetail.init();

        // Wire up callbacks
        vesselSearch.onSelectVessel = (vessel) => {
            this.openVesselDetail(vessel.mmsi);
            this.flyToVessel(vessel);
        };

        vesselDetail.onLocate = (vessel) => {
            this.flyToVessel(vessel);
        };

        // AIS status callback
        aisClient.onStatus = (status, data) => {
            const stateEl = document.getElementById('ais-feed-state');
            if (stateEl) {
                stateEl.textContent = status;
                stateEl.className = status;
            }
            const countEl = document.getElementById('ais-vessel-count');
            if (countEl) {
                countEl.textContent = `${data?.vessel_count || aisClient.vesselCount || 0} VESSELS`;
            }
        };

        // AIS vessel update callback — update map markers
        aisClient.onUpdate = (vessel) => {
            // Only re-render markers if leaflet map is open or we're in vessel mode
            if (this.currentMode === 'vessels') {
                this.updateVesselMap();
            }
            // Update vessel detail if open
            if (vesselDetail.isOpen() && vesselDetail.currentMMSI === vessel.mmsi) {
                vesselDetail.render();
            }
            // Update tracked panel
            if (this.currentMode === 'vessels') {
                vesselSearch.renderTrackedPanel();
            }
        };

        // Connect AIS client
        aisClient.connect();
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const clockEl = document.getElementById('clock');
            if (clockEl) {
                clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC' + (now.getTimezoneOffset() === 0 ? '' : '+' + Math.abs(now.getTimezoneOffset()/60));
            }
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    async refresh() {
        // Fetch events and feed status in parallel
        const [events, status] = await Promise.all([
            api.fetchEvents(),
            api.fetchFeedStatus(),
        ]);

        this.allEvents = events;
        this.feedStatuses = api.feedStatuses;
        this.lastUpdateTime = new Date();

        // Update last-update display
        const updateEl = document.getElementById('last-update');
        if (updateEl) {
            updateEl.textContent = this.lastUpdateTime.toLocaleTimeString('en-US', { hour12: false });
        }

        // Update signal count
        const countEl = document.getElementById('signal-count');
        if (countEl) {
            countEl.textContent = `${events.length} SIGNALS`;
        }

        // Update feed statuses in status bar
        for (const [name, status] of Object.entries(this.feedStatuses)) {
            const el = document.querySelector(`.status-feed[data-feed="${name}"] .feed-state`);
            if (el) {
                el.textContent = status.state;
                el.className = `feed-state ${status.state}`;
            }
        }

        this.render();
    }

    render() {
        const filtered = this.filter.filterEvents(this.allEvents);
        this.filteredEvents = filtered;

        // Always render the ASCII map for default and minimal modes
        const { html: mapHtml, blipCount } = renderMapWithBlips(filtered);

        if (this.currentMode === 'default') {
            // Render ASCII map
            const mapEl = document.getElementById('ascii-map');
            if (mapEl) mapEl.innerHTML = mapHtml;

            const blipEl = document.getElementById('map-blip-count');
            if (blipEl) blipEl.textContent = `${blipCount} BLIPS`;

            // Render feed panels
            renderPanels(this.allEvents, this.filter.activeFilters, (ev) => this.openDetail(ev), 0);
        } else if (this.currentMode === 'timeline') {
            this.modes.renderTimeline(this.allEvents, this.filter.activeFilters);
        } else if (this.currentMode === 'metrics') {
            this.modes.renderMetrics(this.allEvents);
        } else if (this.currentMode === 'minimal') {
            this.modes.renderMinimal(filtered, mapHtml, blipCount);
        } else if (this.currentMode === 'watchlist') {
            this.renderWatchlist();
        } else if (this.currentMode === 'focused') {
            renderFocusedView(this.selectedEvent, this.allEvents);
        } else if (this.currentMode === 'vessels') {
            this.renderVesselMode();
        }
    }

    renderVesselMode() {
        vesselSearch.renderTrackedPanel();
        this.updateVesselMap();
    }

    updateVesselMap() {
        // Only render tracked/selected vessels on the map
        // (canvas layer with all traffic is controlled by the toggle)
        updateVesselMarkers([]);
    }

    renderWatchlist() {
        const container = document.getElementById('watchlist-content');
        if (!container) return;

        const events = this.watchlist.getEvents();
        if (events.length === 0) {
            container.innerHTML = '<div class="watchlist-empty">NO EVENTS PINNED<br><br>Press [W] on any event to pin it here</div>';
            return;
        }

        container.innerHTML = '';
        for (const ev of events) {
            const row = document.createElement('div');
            row.className = `event-row ${ev.severity}`;
            row.innerHTML = `
                <span class="ev-sev ${ev.severity}"></span>
                <span class="ev-time">${ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('en-US',{hour12:false}).substring(0,5) : '--:--'}</span>
                <span class="ev-title">${ev.title}</span>
                <span class="ev-source">${ev.source}</span>
                <span style="color:var(--amber-dim);cursor:pointer;margin-left:8px;" data-remove="${ev.id}">[✕]</span>
            `;
            row.addEventListener('click', (e) => {
                if (e.target.dataset.remove) {
                    this.watchlist.remove(e.target.dataset.remove);
                    this.renderWatchlist();
                } else {
                    this.openDetail(ev);
                }
            });
            container.appendChild(row);
        }
    }

    // Mode switching
    setMode(mode) {
        this.modes.setMode(mode);
    }

    // Detail drawer
    openDetail(event) {
        this.selectedEvent = event;
        this.detail.open(event);
    }

    closeDetail() {
        this.detail.close();
    }

    // Leaflet map
    openLeaflet() {
        const filtered = this.filter.filterEvents(this.allEvents);
        openLeafletMap(filtered);
        // Only show tracked/pinned vessels by default (not all 10K+ vessels)
        setTimeout(() => updateVesselMarkers([]), 200);
    }

    openLeafletForEvent(event) {
        this.openLeaflet();
        setTimeout(() => focusLeafletOnEvent(event), 200);
    }

    closeLeaflet() {
        closeLeafletMap();
    }

    // Filter
    toggleFilter(severity) {
        this.filter.toggle(severity);
        this.filter.updateButtons();
        this.render();
    }

    // AIS vessel methods
    openVesselDetail(mmsi) {
        vesselDetail.open(mmsi);
    }

    closeVesselDetail() {
        vesselDetail.close();
    }

    flyToVessel(vessel) {
        if (!vessel || vessel.lat == null || vessel.lng == null) return;
        // Open leaflet if not open
        const overlay = document.getElementById('leaflet-overlay');
        if (!overlay.classList.contains('open')) {
            this.openLeaflet();
            setTimeout(() => focusOnVessel(vessel), 300);
        } else {
            focusOnVessel(vessel);
        }
    }

    // Watchlist
    toggleWatch(event) {
        this.watchlist.toggle(event);
        if (this.currentMode === 'watchlist') {
            this.renderWatchlist();
        }
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ClermontApp());
} else {
    new ClermontApp();
}