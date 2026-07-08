// watchlist.js — Watchlist management with localStorage persistence

const STORAGE_KEY = 'clermont_watchlist';

export class WatchlistManager {
    constructor() {
        this.pinned = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pinned));
        } catch {
            // localStorage might be unavailable
        }
    }

    toggle(event) {
        const idx = this.pinned.findIndex(e => e.id === event.id);
        if (idx >= 0) {
            this.pinned.splice(idx, 1);
        } else {
            this.pinned.push(event);
        }
        this.save();
    }

    isPinned(eventId) {
        return this.pinned.some(e => e.id === eventId);
    }

    getEvents() {
        // Sort by severity order
        const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return [...this.pinned].sort((a, b) => {
            const sa = sevOrder[a.severity] ?? 9;
            const sb = sevOrder[b.severity] ?? 9;
            if (sa !== sb) return sa - sb;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }

    remove(eventId) {
        this.pinned = this.pinned.filter(e => e.id !== eventId);
        this.save();
    }

    clear() {
        this.pinned = [];
        this.save();
    }
}