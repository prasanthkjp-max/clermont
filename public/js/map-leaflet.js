// map-leaflet.js — Leaflet fullscreen map overlay

let leafletMap = null;
let leafletLayerGroup = null;
let vesselLayerGroup = null;
let vesselMarkers = new Map(); // MMSI -> Leaflet marker

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
    vesselLayerGroup = L.layerGroup().addTo(leafletMap);

    return leafletMap;
}

// --- Vessel markers ---

const vesselSeverityColors = {
    CRITICAL: '#FF2200',
    HIGH: '#FF6600',
    MEDIUM: '#FFB000',
    LOW: '#4A7A00',
};

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

export function updateVesselMarkers(vessels) {
    if (!leafletMap || !vesselLayerGroup) return;

    const seenMMSI = new Set();

    for (const vessel of vessels) {
        if (vessel.lat == null || vessel.lng == null) continue;
        const mmsi = vessel.mmsi;
        seenMMSI.add(mmsi);

        // We need to check tracked/selected status — do it synchronously from a cached set
        // The aisClient.tracked Set and selectedMMSI are available after import
        const isTracked = _aisClient ? _aisClient.isTracked(mmsi) : false;
        const isSelected = _aisClient ? _aisClient.selectedMMSI === mmsi : false;

        const icon = _buildVesselIcon(vessel, isTracked, isSelected);

        if (vesselMarkers.has(mmsi)) {
            // Update existing marker
            const marker = vesselMarkers.get(mmsi);
            marker.setLatLng([vessel.lat, vessel.lng]);
            marker.setIcon(icon);
        } else {
            // Create new marker
            const marker = L.marker([vessel.lat, vessel.lng], { icon: icon, riseOnHover: true });
            marker.on('click', async () => {
                const ais = await _getAISClient();
                ais.selectVessel(mmsi);
                // Open vessel detail
                const event = new CustomEvent('clermont:vessel-selected', { detail: { mmsi } });
                document.dispatchEvent(event);
            });
            marker.addTo(vesselLayerGroup);
            vesselMarkers.set(mmsi, marker);
        }
    }

    // Remove markers for vessels no longer in the list
    for (const [mmsi, marker] of vesselMarkers) {
        if (!seenMMSI.has(mmsi)) {
            vesselLayerGroup.removeLayer(marker);
            vesselMarkers.delete(mmsi);
        }
    }
}

export function focusOnVessel(vessel) {
    if (!leafletMap) return;
    if (vessel.lat != null && vessel.lng != null) {
        leafletMap.setView([vessel.lat, vessel.lng], 8, { animate: true, duration: 1.5 });
        // Highlight by opening popup-like marker
        const marker = vesselMarkers.get(vessel.mmsi);
        if (marker) {
            // Trigger a brief highlight
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
            // Also render vessel markers if available
            _getAISClient().then(ais => {
                const vessels = ais.getAllVessels();
                if (vessels.length > 0) {
                    updateVesselMarkers(vessels);
                }
            });
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