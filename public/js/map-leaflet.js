// map-leaflet.js — Leaflet fullscreen map overlay

let leafletMap = null;
let leafletLayerGroup = null;
let vesselLayerGroup = null;
let vesselMarkers = new Map(); // MMSI -> Leaflet marker
let _vesselMoveHandler = null;

export function initLeafletMap() {
    if (leafletMap) return leafletMap;

    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return null;

    leafletMap = L.map(mapEl, {
        center: [20, 0],
        zoom: 3,
        worldCopyJump: true,
        attributionControl: false,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
    }).addTo(leafletMap);

    leafletLayerGroup = L.layerGroup().addTo(leafletMap);
    vesselLayerGroup = L.layerGroup().addTo(leafletMap);

    // Update vessel markers on map move/zoom (debounced)
    _vesselMoveHandler = L.Util.debounce(() => {
        _renderVesselsInViewport();
    }, 300);
    leafletMap.on('moveend', _vesselMoveHandler);
    leafletMap.on('zoomend', _vesselMoveHandler);

    return leafletMap;
}

// --- Vessel markers ---

function _buildVesselIcon(vessel, isTracked, isSelected) {
    const heading = vessel.heading != null ? vessel.heading : (vessel.cog != null ? vessel.cog : 0);
    const rotation = heading;
    const colorClass = isSelected ? 'selected' : (isTracked ? 'tracked' : '');
    const name = vessel.name || '';
    const labelCls = isSelected ? 'selected' : (isTracked ? 'tracked' : '');

    const html = `
        <div class="vessel-marker-icon">
            ${isTracked ? '<div class="vessel-marker-pulse' + (isSelected ? ' selected' : '') + '"></div>' : ''}
            <div class="vessel-marker-arrow ${colorClass}" style="transform: rotate(${rotation}deg);"></div>
            ${name ? '<div class="vessel-marker-label ' + labelCls + '">' + _escapeHtml(name) + '</div>' : ''}
        </div>
    `;
    return L.divIcon({
        className: 'vessel-marker',
        html: html,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
}

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Import aisClient lazily to avoid circular deps
let _aisClient = null;
async function _getAISClient() {
    if (!_aisClient) {
        const mod = await import('./ais.js');
        _aisClient = mod.aisClient;
    }
    return _aisClient;
}

// Only render vessels within the current map viewport bounds
function _renderVesselsInViewport() {
    if (!leafletMap || !vesselLayerGroup) return;

    const bounds = leafletMap.getBounds();
    const zoom = leafletMap.getZoom();

    // At low zoom (<=4), show fewer markers to avoid clutter — only tracked + nearby
    // At higher zoom, show all vessels in viewport
    const allVessels = _aisClient ? _aisClient.getAllVessels() : [];
    const tracked = _aisClient ? _aisClient.getTrackedVessels() : [];

    // Always include tracked vessels even if outside viewport
    const vesselList = [...tracked];

    // Filter by viewport bounds
    let viewportCount = 0;
    const MAX_MARKERS = 800; // cap to prevent DOM overload

    for (const v of allVessels) {
        if (v.lat == null || v.lng == null) continue;
        if (bounds.contains([v.lat, v.lng])) {
            vesselList.push(v);
            viewportCount++;
            if (viewportCount >= MAX_MARKERS) break;
        }
    }

    const seenMMSI = new Set();

    for (const vessel of vesselList) {
        if (vessel.lat == null || vessel.lng == null) continue;
        const mmsi = vessel.mmsi;
        seenMMSI.add(mmsi);

        const isTracked = _aisClient ? _aisClient.isTracked(mmsi) : false;
        const isSelected = _aisClient ? _aisClient.selectedMMSI === mmsi : false;

        // At low zoom, hide name labels to reduce clutter
        const showLabel = zoom >= 5 || isTracked || isSelected;
        const displayName = showLabel ? (vessel.name || '') : '';

        const icon = _buildVesselIcon({ ...vessel, name: displayName }, isTracked, isSelected);

        if (vesselMarkers.has(mmsi)) {
            const marker = vesselMarkers.get(mmsi);
            marker.setLatLng([vessel.lat, vessel.lng]);
            marker.setIcon(icon);
        } else {
            const marker = L.marker([vessel.lat, vessel.lng], { icon: icon, riseOnHover: true });
            marker.on('click', async () => {
                const ais = await _getAISClient();
                ais.selectVessel(mmsi);
                const event = new CustomEvent('clermont:vessel-selected', { detail: { mmsi } });
                document.dispatchEvent(event);
            });
            marker.addTo(vesselLayerGroup);
            vesselMarkers.set(mmsi, marker);
        }
    }

    // Remove markers no longer in viewport or list
    for (const [mmsi, marker] of vesselMarkers) {
        if (!seenMMSI.has(mmsi)) {
            vesselLayerGroup.removeLayer(marker);
            vesselMarkers.delete(mmsi);
        }
    }
}

export function updateVesselMarkers(vessels) {
    // Now viewport-based — just trigger a re-render
    _renderVesselsInViewport();
}

export function focusOnVessel(vessel) {
    if (!leafletMap) return;
    if (vessel.lat != null && vessel.lng != null) {
        leafletMap.setView([vessel.lat, vessel.lng], 8, { animate: true, duration: 1.5 });
        // Markers will auto-update on moveend
        const marker = vesselMarkers.get(vessel.mmsi);
        if (marker) {
            marker.getElement()?.classList?.add('vessel-focused');
            setTimeout(() => marker.getElement()?.classList?.remove('vessel-focused'), 2000);
        }
    }
}

// Pre-load aisClient so vessel markers can check tracked/selected status immediately
_getAISClient().then(c => { _aisClient = c; });

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
        if (typeof L === 'undefined') {
            console.error('[CLERMONT] Leaflet not loaded');
            return;
        }
        initLeafletMap();
    }
    setTimeout(() => {
        if (leafletMap) {
            leafletMap.invalidateSize();
            updateLeafletMap(events);
            // Render vessels in viewport
            _renderVesselsInViewport();
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
        leafletLayerGroup.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === ev.lat && layer.getLatLng().lng === ev.lng) {
                layer.openPopup();
            }
        });
    }
}