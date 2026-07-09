// vessel-detail.js — Vessel detail slide-up drawer

import { aisClient } from './ais.js?v=3';

class VesselDetail {
    constructor() {
        this.drawer = null;
        this.currentMMSI = null;
        this.onLocate = null;  // callback(vessel)
        this.updateInterval = null;
    }

    init() {
        this.drawer = document.getElementById('vessel-detail-drawer');
        if (!this.drawer) return;

        // Close button
        const closeBtn = document.getElementById('vessel-detail-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Close button in actions
        const closeBtn2 = document.getElementById('vessel-detail-close-2');
        if (closeBtn2) {
            closeBtn2.addEventListener('click', () => this.close());
        }

        // Locate button
        const locateBtn = document.getElementById('vessel-detail-locate');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => {
                const vessel = aisClient.getVessel(this.currentMMSI);
                if (vessel && this.onLocate) this.onLocate(vessel);
            });
        }

        // Track toggle button
        const trackBtn = document.getElementById('vessel-detail-track');
        if (trackBtn) {
            trackBtn.addEventListener('click', () => this.toggleTrack());
        }
    }

    open(mmsi) {
        mmsi = Number(mmsi);
        this.currentMMSI = mmsi;
        this.render();
        this.drawer.classList.add('open');
    }

    close() {
        this.drawer.classList.remove('open');
        this.currentMMSI = null;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    isOpen() {
        return this.drawer && this.drawer.classList.contains('open');
    }

    async toggleTrack() {
        if (this.currentMMSI == null) return;
        if (aisClient.isTracked(this.currentMMSI)) {
            await aisClient.untrackVessel(this.currentMMSI);
        } else {
            await aisClient.trackVessel(this.currentMMSI);
        }
        this.render();
    }

    render() {
        if (this.currentMMSI == null) return;

        const vessel = aisClient.getVessel(this.currentMMSI);
        if (!vessel) {
            this.close();
            return;
        }

        const content = document.getElementById('vessel-detail-content');
        if (!content) return;

        const tracked = aisClient.isTracked(vessel.mmsi);
        const trackBtn = document.getElementById('vessel-detail-track');
        if (trackBtn) {
            trackBtn.textContent = tracked ? '[✕] UNTRACK' : '[●] TRACK';
            trackBtn.classList.toggle('tracking', tracked);
        }

        // Navigation status mapping
        const navStatusMap = {
            0: 'UNDER WAY BY ENGINE',
            1: 'AT ANCHOR',
            2: 'NOT UNDER COMMAND',
            3: 'RESTRICTED MANOEUVERABILITY',
            4: 'CONSTRAINED BY HER DRAUGHT',
            5: 'MOORED',
            6: 'AGROUND',
            7: 'ENGAGED IN FISHING',
            8: 'UNDER WAY SAILING',
            9: 'RESERVED (HAM)',
            10: 'RESERVED',
            11: 'RESERVED',
            12: 'RESERVED',
            13: 'RESERVED',
            14: 'AIS-SART IS ACTIVE',
            15: 'UNDEFINED',
        };

        const navStatus = vessel.nav_status != null
            ? (navStatusMap[vessel.nav_status] || `CODE:${vessel.nav_status}`)
            : 'UNKNOWN';

        const sog = vessel.sog != null ? `${vessel.sog.toFixed(1)} knots` : '---';
        const cog = vessel.cog != null ? `${vessel.cog.toFixed(1)}°` : '---';
        const heading = vessel.heading != null ? `${Math.round(vessel.heading)}°` : '---';
        const lat = vessel.lat != null ? vessel.lat.toFixed(4) : '---';
        const lng = vessel.lng != null ? vessel.lng.toFixed(4) : '---';
        const lastUpdate = vessel.timestamp
            ? new Date(vessel.timestamp).toLocaleString('en-US', { hour12: false })
            : '---';

        content.innerHTML = `
            <div class="vessel-detail-grid">
                <div class="detail-field">
                    <span class="detail-label">NAME</span>
                    <span class="detail-value vessel-detail-name">${this.escape(vessel.name || 'UNKNOWN')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">MMSI</span>
                    <span class="detail-value">${vessel.mmsi || '---'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">IMO</span>
                    <span class="detail-value">${vessel.imo || '---'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">CALLSIGN</span>
                    <span class="detail-value">${vessel.callsign || '---'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">TYPE</span>
                    <span class="detail-value">${vessel.ship_type || '---'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">POSITION</span>
                    <span class="detail-value">${lat}, ${lng}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">SOG</span>
                    <span class="detail-value">${sog}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">COG</span>
                    <span class="detail-value">${cog}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">HEADING</span>
                    <span class="detail-value">${heading}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">NAV STATUS</span>
                    <span class="detail-value">${navStatus}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">DESTINATION</span>
                    <span class="detail-value">${this.escape(vessel.destination || '---')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">ETA</span>
                    <span class="detail-value">${vessel.eta || '---'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">LAST UPDATE</span>
                    <span class="detail-value">${lastUpdate}</span>
                </div>
            </div>
        `;

        // Auto-update the drawer every 2 seconds while open
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => {
                if (this.isOpen() && this.currentMMSI != null) {
                    this.render();
                }
            }, 2000);
        }
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

export const vesselDetail = new VesselDetail();