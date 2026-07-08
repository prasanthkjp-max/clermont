// ais.js — AIS vessel tracking SSE client

class AISClient {
    constructor() {
        this.vessels = new Map(); // MMSI -> vessel object
        this.tracked = new Set(); // tracked MMSI set
        this.selectedMMSI = null;
        this.eventSource = null;
        this.status = 'OFFLINE';
        this.vesselCount = 0;
        this.onUpdate = null;      // callback(vessel)
        this.onStatus = null;       // callback(status)
    }

    async connect() {
        // Fetch initial vessel list
        try {
            const resp = await fetch('/api/ais/vessels?limit=5000');
            if (resp.ok) {
                const data = await resp.json();
                if (data.vessels) {
                    for (const v of data.vessels) {
                        this.vessels.set(v.mmsi, v);
                    }
                    this.vesselCount = this.vessels.size;
                }
            }
        } catch (e) {
            console.warn('[AIS] Failed to fetch initial vessels:', e.message);
        }

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

        // Connect SSE stream
        this._connectSSE();

        // Periodic status refresh
        setInterval(() => this.fetchStatus(), 30000);
    }

    _connectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        try {
            this.eventSource = new EventSource('/api/ais/stream');

            this.eventSource.onmessage = (event) => {
                try {
                    const vessel = JSON.parse(event.data);
                    if (vessel && vessel.mmsi) {
                        // Merge with existing data (new position report may not have all static data)
                        const existing = this.vessels.get(vessel.mmsi) || {};
                        const merged = { ...existing, ...vessel };
                        this.vessels.set(vessel.mmsi, merged);
                        this.vesselCount = this.vessels.size;

                        if (this.onUpdate) {
                            this.onUpdate(merged);
                        }
                    }
                } catch (e) {
                    // ignore parse errors
                }
            };

            this.eventSource.onerror = () => {
                this.status = 'DEGRADED';
                if (this.onStatus) this.onStatus(this.status);
                // EventSource will auto-reconnect; just update UI
            };

            this.eventSource.onopen = () => {
                if (this.status === 'DEGRADED') {
                    this.status = 'ONLINE';
                    if (this.onStatus) this.onStatus(this.status);
                }
            };
        } catch (e) {
            console.warn('[AIS] SSE connection failed:', e.message);
            this.status = 'OFFLINE';
            if (this.onStatus) this.onStatus(this.status);
            // Retry after delay
            setTimeout(() => this._connectSSE(), 5000);
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
        return this.vessels.get(Number(mmsi));
    }

    getAllVessels() {
        return Array.from(this.vessels.values());
    }

    getTrackedVessels() {
        return Array.from(this.vessels.values()).filter(v => this.tracked.has(v.mmsi));
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
        return this.vessels.get(this.selectedMMSI);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
}

export const aisClient = new AISClient();
export { AISClient };