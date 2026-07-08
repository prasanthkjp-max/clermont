// map-leaflet.js — Leaflet fullscreen map overlay

let leafletMap = null;
let leafletLayerGroup = null;

export function initLeafletMap() {
    if (leafletMap) return leafletMap;

    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return null;

    // Use CartoDB Dark Matter tiles
    leafletMap = L.map(mapEl, {
        center: [20, 0],
        zoom: 2,
        worldCopyJump: true,
        attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
    }).addTo(leafletMap);

    leafletLayerGroup = L.layerGroup().addTo(leafletMap);

    return leafletMap;
}

const severityColors = {
    CRITICAL: '#FF2200',
    HIGH: '#FF6600',
    MEDIUM: '#FFB000',
    LOW: '#4A7A00',
};

export function updateLeafletMap(events) {
    if (!leafletMap || !leafletLayerGroup) return;
    leafletLayerGroup.clearLayers();

    for (const ev of events) {
        if (ev.lat == null || ev.lng == null) continue;

        const color = severityColors[ev.severity] || '#FFB000';

        // Pulsing circle marker
        const marker = L.circleMarker([ev.lat, ev.lng], {
            radius: 8,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.4,
        });

        const popupHtml = `
            <div style="font-family:monospace;background:#111;color:#FFB000;padding:8px;min-width:200px;">
                <div style="font-size:10px;color:#8a6000;margin-bottom:4px;">${ev.feed} | ${ev.severity}</div>
                <div style="font-size:12px;margin-bottom:6px;">${ev.title}</div>
                <div style="font-size:10px;color:#8a6000;">${ev.source}</div>
                <div style="font-size:10px;color:#8a6000;">${ev.timestamp}</div>
                <div style="font-size:10px;color:#8a6000;">${ev.lat.toFixed(2)}, ${ev.lng.toFixed(2)}</div>
                ${ev.url ? `<a href="${ev.url}" target="_blank" style="color:#FFB000;font-size:10px;">[LINK]</a>` : ''}
            </div>
        `;
        marker.bindPopup(popupHtml, { className: 'clermont-popup' });

        // Add a glow ring for CRITICAL/HIGH
        if (ev.severity === 'CRITICAL' || ev.severity === 'HIGH') {
            L.circleMarker([ev.lat, ev.lng], {
                radius: 16,
                fillColor: color,
                color: color,
                weight: 1,
                opacity: 0.3,
                fillOpacity: 0.1,
            }).addTo(leafletLayerGroup);
        }

        marker.addTo(leafletLayerGroup);
    }
}

export function openLeafletMap(events) {
    const overlay = document.getElementById('leaflet-overlay');
    overlay.classList.add('open');
    if (!leafletMap) {
        // Leaflet might not be loaded yet
        if (typeof L === 'undefined') {
            console.error('[CLERMONT] Leaflet not loaded');
            return;
        }
        initLeafletMap();
    }
    // Invalidate size after the element becomes visible
    setTimeout(() => {
        if (leafletMap) {
            leafletMap.invalidateSize();
            updateLeafletMap(events);
        }
    }, 100);
}

export function closeLeafletMap() {
    const overlay = document.getElementById('leaflet-overlay');
    overlay.classList.remove('open');
}

export function focusLeafletOnEvent(ev) {
    if (!leafletMap) return;
    if (ev.lat != null && ev.lng != null) {
        leafletMap.setView([ev.lat, ev.lng], 6);
        // Highlight the marker
        leafletLayerGroup.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === ev.lat && layer.getLatLng().lng === ev.lng) {
                layer.openPopup();
            }
        });
    }
}