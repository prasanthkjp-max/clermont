// detail.js — Event detail drawer controller

export class DetailController {
    constructor(app) {
        this.app = app;
        this.currentEvent = null;
        this.bind();
    }

    bind() {
        const closeBtn = document.getElementById('detail-close');
        const closeBtn2 = document.getElementById('detail-close-2');
        const mapBtn = document.getElementById('detail-map');
        const watchBtn = document.getElementById('detail-watch');
        const focusBtn = document.getElementById('detail-focus');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (closeBtn2) closeBtn2.addEventListener('click', () => this.close());
        if (mapBtn) mapBtn.addEventListener('click', () => this.mapAction());
        if (watchBtn) watchBtn.addEventListener('click', () => this.watchAction());
        if (focusBtn) focusBtn.addEventListener('click', () => this.focusAction());
    }

    open(event) {
        this.currentEvent = event;
        const drawer = document.getElementById('detail-drawer');
        const titleEl = document.getElementById('detail-title');
        const contentEl = document.getElementById('detail-content');

        if (!drawer || !contentEl) return;

        titleEl.textContent = `${event.feed} — ${event.severity}`;

        const coords = (event.lat != null && event.lng != null) ?
            `${event.lat.toFixed(2)}, ${event.lng.toFixed(2)}` : 'N/A';

        const watchLabel = this.app.watchlist.isPinned(event.id) ? 'UNWATCH' : 'WATCH';
        if (watchBtn) {
            const watchBtnEl = document.getElementById('detail-watch');
            if (watchBtnEl) watchBtnEl.textContent = `[W] ${watchLabel}`;
        }

        contentEl.innerHTML = `
            <div class="detail-field">
                <span class="detail-label">FEED:</span>
                <span class="detail-value">${event.feed}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">SEVERITY:</span>
                <span class="detail-value ${event.severity}">${event.severity}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">TIME:</span>
                <span class="detail-value">${event.timestamp}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">SOURCE:</span>
                <span class="detail-value">${event.source}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">COORDS:</span>
                <span class="detail-value">${coords}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">TITLE:</span>
                <span class="detail-value">${event.title}</span>
            </div>
            ${event.url ? `
            <div class="detail-field">
                <span class="detail-label">URL:</span>
                <a class="detail-url" href="${event.url}" target="_blank">${event.url}</a>
            </div>` : ''}
        `;

        drawer.classList.add('open');
    }

    close() {
        const drawer = document.getElementById('detail-drawer');
        if (drawer) drawer.classList.remove('open');
        this.currentEvent = null;
    }

    mapAction() {
        if (this.currentEvent && this.currentEvent.lat != null) {
            this.app.openLeafletForEvent(this.currentEvent);
        } else {
            this.app.openLeaflet();
        }
    }

    watchAction() {
        if (this.currentEvent) {
            this.app.toggleWatch(this.currentEvent);
            this.open(this.currentEvent); // Refresh to update button label
        }
    }

    focusAction() {
        if (this.currentEvent) {
            this.app.setMode('focused');
        }
    }
}

export function renderFocusedView(event, allEvents) {
    const headerEl = document.getElementById('focused-header');
    const contentEl = document.getElementById('focused-content');
    if (!contentEl) return;

    if (!event) {
        contentEl.innerHTML = '<div style="padding:20px;color:var(--amber-dim);">NO EVENT SELECTED</div>';
        return;
    }

    if (headerEl) headerEl.textContent = `FOCUSED — ${event.feed} ${event.severity}`;

    const coords = (event.lat != null && event.lng != null) ?
        `${event.lat.toFixed(2)}, ${event.lng.toFixed(2)}` : 'N/A';

    let html = `
        <div class="focused-detail">
            <div class="focused-field"><span class="focused-label">FEED:</span><span class="focused-value">${event.feed}</span></div>
            <div class="focused-field"><span class="focused-label">SEVERITY:</span><span class="focused-value ${event.severity}">${event.severity}</span></div>
            <div class="focused-field"><span class="focused-label">TIME:</span><span class="focused-value">${event.timestamp}</span></div>
            <div class="focused-field"><span class="focused-label">SOURCE:</span><span class="focused-value">${event.source}</span></div>
            <div class="focused-field"><span class="focused-label">COORDS:</span><span class="focused-value">${coords}</span></div>
            <div class="focused-field"><span class="focused-label">TITLE:</span><span class="focused-value">${event.title}</span></div>
            ${event.url ? `<div class="focused-field"><span class="focused-label">URL:</span><a class="detail-url focused-value" href="${event.url}" target="_blank">${event.url}</a></div>` : ''}
        </div>
    `;

    // Related events from same feed
    const related = allEvents
        .filter(e => e.feed === event.feed && e.id !== event.id)
        .slice(0, 10);

    if (related.length > 0) {
        html += '<div class="focused-related-title">RELATED SIGNALS — SAME FEED</div>';
        for (const rel of related) {
            html += `
                <div class="event-row ${rel.severity}" data-event-id="${rel.id}" style="cursor:pointer;">
                    <span class="ev-sev ${rel.severity}"></span>
                    <span class="ev-time">${rel.timestamp ? new Date(rel.timestamp).toLocaleTimeString('en-US',{hour12:false}).substring(0,5) : '--:--'}</span>
                    <span class="ev-title">${rel.title}</span>
                    <span class="ev-source">${rel.source}</span>
                </div>
            `;
        }
    }

    contentEl.innerHTML = html;

    // Bind click on related events
    contentEl.querySelectorAll('.event-row').forEach(row => {
        row.addEventListener('click', () => {
            const ev = allEvents.find(e => e.id === row.dataset.eventId);
            if (ev) {
                renderFocusedView(ev, allEvents);
            }
        });
    });
}