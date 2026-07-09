// api.js — API client for Clermont backend

import { MOCK_EVENTS } from './mock-data.js?v=4';

const API_BASE = '';

export class ApiClient {
    constructor() {
        this.events = [];
        this.feedStatuses = {};
        this.lastUpdate = null;
    }

    async fetchEvents() {
        try {
            const resp = await fetch(`${API_BASE}/api/events`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                this.events = data;
                this.lastUpdate = new Date();
                return data;
            }
            // Empty but valid — keep existing or use mock
            if (data.length === 0) {
                this.events = MOCK_EVENTS;
                this.lastUpdate = new Date();
                return this.events;
            }
            return data;
        } catch (e) {
            console.warn('[CLERMONT] API fetch failed, using mock data:', e.message);
            this.events = MOCK_EVENTS;
            this.lastUpdate = new Date();
            return this.events;
        }
    }

    async fetchFeedStatus() {
        try {
            const resp = await fetch(`${API_BASE}/api/feeds/status`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data && data.feeds) {
                for (const fs of data.feeds) {
                    this.feedStatuses[fs.name] = fs;
                }
            }
            return data;
        } catch (e) {
            console.warn('[CLERMONT] Feed status fetch failed:', e.message);
            // Return mock statuses
            this.feedStatuses = {
                GEO: {name:"GEO",state:"DEGRADED",event_count:8,error:"Offline"},
                ENV: {name:"ENV",state:"DEGRADED",event_count:8,error:"Offline"},
                MKT: {name:"MKT",state:"DEGRADED",event_count:6,error:"Offline"},
                INF: {name:"INF",state:"DEGRADED",event_count:7,error:"Offline"},
            };
            return {feeds: Object.values(this.feedStatuses), total_events: 29};
        }
    }

    getEventsByFeed(feed) {
        return this.events.filter(e => e.feed === feed);
    }

    getFilteredEvents(activeFilters) {
        return this.events.filter(e => activeFilters.has(e.severity));
    }

    getEventsWithCoords() {
        return this.events.filter(e => e.lat !== null && e.lng !== null && e.lat !== undefined && e.lng !== undefined);
    }
}

export const api = new ApiClient();