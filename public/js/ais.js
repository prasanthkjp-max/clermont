// ais.js — AIS vessel tracking client (polling-based, works through Cloudflare)

class AISClient {
    constructor() {
        this.vessels = new Map(); // MMSI -> full vessel object
        this.lightVessels = new Map(); // MMSI -> lightweight {m,n,la,lo,h,s}
        this.tracked = new Set(); // tracked MMSI set
        this.selectedMMSI = null;
        this.status = 'OFFLINE';
        this.vesselCount = 0;
        this.onUpdate = null;       // callback(vessel)
        this.onBatchUpdate = null;  // callback() — after batch of updates
        this.onStatus = null;       // callback(status, data)
        this._pollInterval = null;
        this._fullPollInterval = null;
    }

    async connect() {
        // Fetch initial lightweight vessel list (for map markers)
        await this._fetchLightVessels();

        // Fetch tracked vessels
        try {
            const resp = await fetch('/api/ais/tracked');
            if (resp.ok) {
                const data = await resp.json();
                if (data.vessels) {
                    for (const v of data.vessels) {
                        this.tracked.add(v.mmsi);
                    }
                }
            }
        } catch (e) {
            console.warn('[AIS] Failed to fetch tracked vessels:', e.message);
        }

        // Fetch feed status
        await this.fetchStatus();

        // Light polling every 10s for map markers (small payload)
        this._startLightPolling();
        // Full data polling every 30s for tracked vessel details
        this._startFullPolling();

        // Periodic status refresh
        setInterval(() => this.fetchStatus(), 30000);
    }

    async _fetchLightVessels() {
        try {
            const resp = await fetch('/api/ais/vessels/light');
            if (resp.ok) {
                const data = await resp.json();
                if (data.v) {
                    this.lightVessels.clear();
                    for (const v of data.v) {
                        this.lightVessels.set(v.m, v);
                    }
                    this.vesselCount = data.c || this.lightVessels.size;
                    if (this.onBatchUpdate) this.onBatchUpdate();
                }
            }
        } catch (e) {
            console.warn('[AIS] Failed to fetch light vessels:', e.message);
        }
    }

    _startLightPolling() {
        if (this._pollInterval) clearInterval(this._pollInterval);
        // 15s interval — reasonable balance between freshness and bandwidth
        this._pollInterval = setInterval(() => this._fetchLightVessels(), 15000);
    }

    _startFullPolling() {
        if (this._fullPollInterval) clearInterval(this._fullPollInterval);
        this._fullPollInterval = setInterval(() => this._pollTrackedVessels(), 30000);
    }

    _stopPolling() {
        if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
        if (this._fullPollInterval) { clearInterval(this._fullPollInterval); this._fullPollInterval = null; }
    }

    async _pollTrackedVessels() {
        // Only fetch full details for tracked vessels
        const tracked = Array.from(this.tracked);
        for (const mmsi of tracked) {
            try {
                const resp = await fetch(`/api/ais/vessels/${mmsi}`);
                if (resp.ok) {
                    const vessel = await resp.json();
                    this.vessels.set(mmsi, vessel);
                    if (this.onUpdate) this.onUpdate(vessel);
                }
            } catch (e) {
                // silent
            }
        }
    }

    async fetchStatus() {
        try {
            const resp = await fetch('/api/ais/status');
            if (resp.ok) {
                const data = await resp.json();
                this.status = data.state || 'OFFLINE';
                this.vesselCount = data.vessel_count || 0;
                if (this.onStatus) this.onStatus(this.status, data);
            }
        } catch (e) {
            this.status = 'OFFLINE';
            if (this.onStatus) this.onStatus(this.status);
        }
    }

    getVessel(mmsi) {
        mmsi = Number(mmsi);
        // Return full vessel data if we have it, otherwise build from light data
        const full = this.vessels.get(mmsi);
        if (full) return full;
        const light = this.lightVessels.get(mmsi);
        if (light) {
            return {
                mmsi: light.m,
                name: light.n || '',
                lat: light.la,
                lng: light.lo,
                heading: light.h,
                sog: light.s,
                cog: null,
                nav_status: null,
                timestamp: null,
                destination: '',
                eta: '',
                ship_type: '',
                imo: '',
                callsign: '',
            };
        }
        return null;
    }

    getAllVessels() {
        // Return array suitable for map marker rendering (from light data)
        const result = [];
        for (const [mmsi, v] of this.lightVessels) {
            result.push({
                mmsi: v.m,
                name: v.n || '',
                lat: v.la,
                lng: v.lo,
                heading: v.h,
                sog: v.s,
            });
        }
        return result;
    }

    getTrackedVessels() {
        const result = [];
        for (const mmsi of this.tracked) {
            const v = this.getVessel(mmsi);
            if (v) result.push(v);
        }
        return result;
    }

    isTracked(mmsi) {
        return this.tracked.has(Number(mmsi));
    }

    async trackVessel(mmsi) {
        mmsi = Number(mmsi);
        try {
            const resp = await fetch(`/api/ais/track/${mmsi}`, { method: 'POST' });
            if (resp.ok) {
                this.tracked.add(mmsi);
                // Fetch full details immediately
                const detailResp = await fetch(`/api/ais/vessels/${mmsi}`);
                if (detailResp.ok) {
                    const vessel = await detailResp.json();
                    this.vessels.set(mmsi, vessel);
                }
                return true;
            }
        } catch (e) {
            console.warn('[AIS] Failed to track vessel:', e.message);
        }
        return false;
    }

    async untrackVessel(mmsi) {
        mmsi = Number(mmsi);
        try {
            const resp = await fetch(`/api/ais/track/${mmsi}`, { method: 'DELETE' });
            if (resp.ok) {
                this.tracked.delete(mmsi);
                return true;
            }
        } catch (e) {
            console.warn('[AIS] Failed to untrack vessel:', e.message);
        }
        return false;
    }

    async searchVessels(query) {
        if (!query || query.trim().length === 0) return [];
        try {
            const resp = await fetch(`/api/ais/vessels?search=${encodeURIComponent(query)}&limit=50`);
            if (resp.ok) {
                const data = await resp.json();
                return data.vessels || [];
            }
        } catch (e) {
            console.warn('[AIS] Search failed:', e.message);
        }
        return [];
    }

    selectVessel(mmsi) {
        this.selectedMMSI = Number(mmsi);
    }

    getSelected() {
        if (this.selectedMMSI == null) return null;
        return this.getVessel(this.selectedMMSI);
    }

    disconnect() {
        this._stopPolling();
    }
}

export const aisClient = new AISClient();
export { AISClient };