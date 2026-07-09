// map-leaflet.js — Leaflet fullscreen map overlay
// Canvas-based rendering for vessel markers
// By default: only show tracked/pinned vessels. Toggle to show all traffic.

let leafletMap = null;
let leafletLayerGroup = null;
let vesselLayerGroup = null;       // DOM layer for tracked/selected
let vesselCanvasLayer = null;      // Canvas layer for bulk vessels
let vesselMarkers = new Map();     // MMSI -> Leaflet marker (DOM, tracked/selected only)
let _vesselMoveHandler = null;
let _showAllVesselTraffic = false;  // Toggle: false = only tracked, true = all traffic

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
        preferCanvas: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
    }).addTo(leafletMap);

    leafletLayerGroup = L.layerGroup().addTo(leafletMap);
    vesselLayerGroup = L.layerGroup().addTo(leafletMap);

    // Custom canvas overlay for bulk vessel rendering
    vesselCanvasLayer = new VesselCanvasLayer().addTo(leafletMap);

    // Update vessel markers on map move/zoom (debounced)
    _vesselMoveHandler = L.Util.debounce(() => {
        _renderVesselsInViewport();
    }, 200);
    leafletMap.on('moveend', _vesselMoveHandler);
    leafletMap.on('zoomend', _vesselMoveHandler);

    return leafletMap;
}

// ---------------------------------------------------------------------------
// "Show all traffic" toggle
// ---------------------------------------------------------------------------

export function isShowingAllTraffic() {
    return _showAllVesselTraffic;
}

export function toggleAllVesselTraffic() {
    _showAllVesselTraffic = !_showAllVesselTraffic;
    _renderVesselsInViewport();
    // Update button label and class
    const btn = document.getElementById('leaflet-toggle-traffic');
    if (btn) {
        if (_showAllVesselTraffic) {
            btn.textContent = '[●] ALL TRAFFIC: ON';
            btn.classList.add('active');
        } else {
            btn.textContent = '[○] ALL TRAFFIC: OFF';
            btn.classList.remove('active');
        }
    }
    return _showAllVesselTraffic;
}

// ---------------------------------------------------------------------------
// Custom Canvas Layer for bulk vessel rendering
// ---------------------------------------------------------------------------

const VesselCanvasLayer = L.Layer.extend({
    initialize: function() {
        this._canvas = null;
        this._ctx = null;
        this._vessels = [];
    },

    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-vessel-canvas-layer');
        const size = map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.position = 'absolute';
        this._canvas.style.top = '0';
        this._canvas.style.left = '0';
        this._canvas.style.pointerEvents = 'none';
        this._canvas.style.zIndex = 300;

        map.getPanes().overlayPane.appendChild(this._canvas);

        this._ctx = this._canvas.getContext('2d');

        map.on('move zoomend resize', this._update, this);
        this._update();
    },

    onRemove: function(map) {
        map.off('move zoomend resize', this._update, this);
        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
    },

    setVessels: function(vessels) {
        this._vessels = vessels;
        this._update();
    },

    _update: function() {
        if (!this._map || !this._canvas || !this._ctx) return;

        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;

        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);

        const ctx = this._ctx;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        if (this._vessels.length === 0) return;

        const zoom = this._map.getZoom();
        const bounds = this._map.getBounds();
        const showLabels = zoom >= 6;
        const arrowSize = zoom <= 3 ? 4 : zoom <= 5 ? 6 : 8;

        let drawn = 0;
        const MAX_CANVAS_VESSELS = 5000;

        for (const v of this._vessels) {
            if (v.lat == null || v.lng == null) continue;
            if (!bounds.contains([v.lat, v.lng])) continue;

            const point = this._map.latLngToContainerPoint([v.lat, v.lng]);
            if (point.x < -20 || point.x > size.x + 20 || point.y < -20 || point.y > size.y + 20) continue;

            const heading = v.heading != null ? v.heading : (v.cog != null ? v.cog : 0);
            const rad = (heading - 90) * Math.PI / 180;

            // Draw arrow on canvas
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(rad);

            ctx.beginPath();
            ctx.moveTo(arrowSize, 0);
            ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.5);
            ctx.lineTo(-arrowSize * 0.3, 0);
            ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.5);
            ctx.closePath();

            ctx.fillStyle = 'rgba(255, 176, 0, 0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 176, 0, 0.85)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            ctx.restore();

            // Draw name label at higher zoom
            if (showLabels && v.name) {
                ctx.font = '9px "Share Tech Mono", monospace';
                ctx.fillStyle = 'rgba(255, 176, 0, 0.75)';
                ctx.textAlign = 'center';
                ctx.fillText(v.name.substring(0, 18), point.x, point.y + arrowSize + 10);
            }

            drawn++;
            if (drawn >= MAX_CANVAS_VESSELS) break;
        }
    },
});

// ---------------------------------------------------------------------------
// Vessel rendering — canvas for bulk (when toggled), DOM for tracked/selected
// ---------------------------------------------------------------------------

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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

// Import aisClient lazily to avoid circular deps
let _aisClient = null;
async function _getAISClient() {
    if (!_aisClient) {
        const mod = await import('./ais.js');
        _aisClient = mod.aisClient;
    }
    return _aisClient;
}

// Render vessels: canvas for bulk (only if toggle on), DOM for tracked/selected
function _renderVesselsInViewport() {
    if (!leafletMap) return;

    const tracked = _aisClient ? _aisClient.getTrackedVessels() : [];

    // --- Canvas layer: only draw bulk vessels if toggle is ON ---
    if (_showAllVesselTraffic && _aisClient) {
        const allVessels = _aisClient.getAllVessels();
        const canvasVessels = [];
        for (const v of allVessels) {
            if (v.lat == null || v.lng == null) continue;
            const isTracked = _aisClient.isTracked(v.mmsi);
            const isSelected = _aisClient.selectedMMSI === v.mmsi;
            if (!isTracked && !isSelected) {
                canvasVessels.push(v);
            }
        }
        if (vesselCanvasLayer) {
            vesselCanvasLayer.setVessels(canvasVessels);
        }
    } else {
        // Toggle off: clear canvas
        if (vesselCanvasLayer) {
            vesselCanvasLayer.setVessels([]);
        }
    }

    // --- DOM layer: tracked + selected vessels (always shown) ---
    const domVessels = [...tracked];
    if (_aisClient && _aisClient.selectedMMSI != null) {
        const sel = _aisClient.getVessel(_aisClient.selectedMMSI);
        if (sel && !_aisClient.isTracked(_aisClient.selectedMMSI)) {
            domVessels.push(sel);
        }
    }

    const seenMMSI = new Set();
    const zoom = leafletMap.getZoom();

    for (const vessel of domVessels) {
        if (vessel.lat == null || vessel.lng == null) continue;
        const mmsi = vessel.mmsi;
        seenMMSI.add(mmsi);

        const isTracked = _aisClient ? _aisClient.isTracked(mmsi) : false;
        const isSelected = _aisClient ? _aisClient.selectedMMSI === mmsi : false;
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

    // Remove DOM markers no longer tracked/selected
    for (const [mmsi, marker] of vesselMarkers) {
        if (!seenMMSI.has(mmsi)) {
            vesselLayerGroup.removeLayer(marker);
            vesselMarkers.delete(mmsi);
        }
    }
}

export function updateVesselMarkers(vessels) {
    _renderVesselsInViewport();
}

export function focusOnVessel(vessel) {
    if (!leafletMap) return;
    if (vessel.lat != null && vessel.lng != null) {
        leafletMap.setView([vessel.lat, vessel.lng], 8, { animate: true, duration: 1.5 });
        const marker = vesselMarkers.get(vessel.mmsi);
        if (marker) {
            marker.getElement()?.classList?.add('vessel-focused');
            setTimeout(() => marker.getElement()?.classList?.remove('vessel-focused'), 2000);
        }
    }
}

// Pre-load aisClient so vessel markers can check tracked/selected status immediately
_getAISClient().then(c => { _aisClient = c; });

// ---------------------------------------------------------------------------
// Event markers (original functionality)
// ---------------------------------------------------------------------------

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