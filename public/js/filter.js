// filter.js — Severity filter controller

export class FilterController {
    constructor() {
        this.activeFilters = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
        this.bind();
    }

    bind() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const severity = btn.dataset.severity;
                this.toggle(severity);
                this.updateButtons();
            });
        });
    }

    toggle(severity) {
        if (this.activeFilters.has(severity)) {
            this.activeFilters.delete(severity);
        } else {
            this.activeFilters.add(severity);
        }
    }

    updateButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const sev = btn.dataset.severity;
            btn.classList.toggle('active', this.activeFilters.has(sev));
        });
    }

    isActive(severity) {
        return this.activeFilters.has(severity);
    }

    filterEvents(events) {
        return events.filter(e => this.activeFilters.has(e.severity));
    }
}