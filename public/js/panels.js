// panels.js — Feed panel rendering

const FEEDS = ['GEO', 'ENV', 'MKT', 'INF'];

export function renderPanels(events, activeFilters, onSelectEvent, selectedIndex) {
    for (const feed of FEEDS) {
        const panelBody = document.getElementById(`panel-${feed}`);
        const countEl = document.getElementById(`count-${feed}`);
        if (!panelBody) continue;

        const feedEvents = events.filter(e => e.feed === feed && activeFilters.has(e.severity));
        countEl.textContent = feedEvents.length;

        if (feedEvents.length === 0) {
            panelBody.innerHTML = '<div style="padding:8px;color:var(--amber-dim);font-size:11px;">NO SIGNALS</div>';
            continue;
        }

        panelBody.innerHTML = '';
        feedEvents.forEach((ev, idx) => {
            const row = document.createElement('div');
            row.className = `event-row ${ev.severity}`;
            row.dataset.eventId = ev.id;
            row.dataset.feedIndex = idx;

            const time = ev.timestamp ? formatTime(ev.timestamp) : '--:--';
            row.innerHTML = `
                <span class="ev-sev ${ev.severity}"></span>
                <span class="ev-time">${time}</span>
                <span class="ev-title">${ev.title}</span>
                <span class="ev-source">${ev.source}</span>
            `;
            row.addEventListener('click', () => onSelectEvent(ev));
            panelBody.appendChild(row);
        });
    }
}

function formatTime(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour12: false }).substring(0, 5);
    } catch {
        return '--:--';
    }
}

export function getPanelEventByIndex(feed, events, activeFilters, index) {
    const feedEvents = events.filter(e => e.feed === feed && activeFilters.has(e.severity));
    return feedEvents[index] || null;
}

export function getPanelEventCount(feed, events, activeFilters) {
    return events.filter(e => e.feed === feed && activeFilters.has(e.severity)).length;
}