// map-ascii.js — ASCII Braille world map renderer

const MAP_WIDTH = 120;
const MAP_HEIGHT = 50;

// Braille unicode range: U+2800 to U+28FF
// Each Braille char encodes a 2x4 grid of dots
const BRAILLE_BASE = 0x2800;

// Dot positions within a Braille char (2 columns x 4 rows):
// 0x01 0x08
// 0x02 0x10
// 0x04 0x20
// 0x40 0x80
const DOT_BITS = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
];

// Map a lat/lng to pixel coordinates on our grid
export function projectLatLng(lat, lng, width, height) {
    // Equirectangular projection
    const x = Math.floor(((lng + 180) / 360) * width);
    const y = Math.floor(((90 - lat) / 180) * height);
    return { x, y };
}

// Convert a grid of booleans (width x height) to Braille characters
function gridToBraille(grid, width, height) {
    const charsWide = Math.ceil(width / 2);
    const charsHigh = Math.ceil(height / 4);
    const lines = [];

    for (let cy = 0; cy < charsHigh; cy++) {
        let line = '';
        for (let cx = 0; cx < charsWide; cx++) {
            let bits = 0;
            for (let dy = 0; dy < 4; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const gx = cx * 2 + dx;
                    const gy = cy * 4 + dy;
                    if (gx < width && gy < height && grid[gy * width + gx]) {
                        bits |= DOT_BITS[dy][dx];
                    }
                }
            }
            line += String.fromCharCode(BRAILLE_BASE + bits);
        }
        lines.push(line);
    }
    return lines.join('\n');
}

// Simple landmass detection using a bounding-box approximation
// This creates a recognizable world map shape without needing topojson parsing
function buildWorldGrid(width, height) {
    const grid = new Array(width * height).fill(false);

    // Define landmass regions as [latMin, latMax, lngMin, lngMax] rough polygons
    // Using a set of rectangles to approximate continents
    const landmasses = [
        // North America
        { points: [[70,-170],[72,-100],[60,-55],[45,-60],[30,-115],[25,-110],[15,-100],[10,-80],[-5,-80],[10,-95],[25,-105],[30,-120],[55,-165],[65,-170]] },
        // South America
        { points: [[12,-80],[10,-50],[-5,-35],[-25,-40],[-55,-70],[-35,-75],[-10,-80],[-5,-80]] },
        // Europe
        { points: [[71,25],[70,40],[55,40],[45,10],[36,-5],[36,25],[40,30],[55,30],[65,25]] },
        // Africa
        { points: [[35,-15],[35,35],[12,40],[-5,40],[-35,20],[-35,15],[-20,10],[-5,8],[5,-15],[15,-18],[25,-15]] },
        // Asia
        { points: [[75,30],[75,180],[55,140],[40,130],[30,120],[10,105],[5,100],[10,80],[20,70],[25,55],[30,35],[40,30],[55,30],[65,40],[70,40],[75,30]] },
        // Australia
        { points: [[-10,115],[-12,150],[-25,155],[-40,145],[-38,115],[-25,113]] },
        // Indonesia/Malaysia
        { points: [[5,95],[5,120],[-5,140],[-10,120],[-5,95]] },
        // Greenland
        { points: [[83,-45],[80,-20],[65,-20],[60,-45],[70,-55],[80,-50]] },
        // UK
        { points: [[58,-8],[58,0],[50,0],[50,-8]] },
        // Japan
        { points: [[45,130],[45,145],[30,140],[30,130]] },
        // Madagascar
        { points: [[-12,43],[-25,50],[-25,43]] },
        // New Zealand
        { points: [[-35,170],[-47,170],[-47,175],[-35,178]] },
    ];

    // Point-in-polygon test
    function pointInPolygon(lat, lng, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i][0], yi = points[i][1];
            const xj = points[j][0], yj = points[j][1];
            if (((yi > lng) !== (yj > lng)) &&
                (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const lng = (x / width) * 360 - 180;
            const lat = 90 - (y / height) * 180;
            for (const land of landmasses) {
                if (pointInPolygon(lat, lng, land.points)) {
                    grid[y * width + x] = true;
                    break;
                }
            }
        }
    }

    return grid;
}

// Build the map and return it as a string
let cachedMapString = null;

export function buildAsciiMap() {
    if (cachedMapString) return cachedMapString;
    const grid = buildWorldGrid(MAP_WIDTH, MAP_HEIGHT);
    cachedMapString = gridToBraille(grid, MAP_WIDTH, MAP_HEIGHT);
    return cachedMapString;
}

// Overlay event blips on the ASCII map
export function renderMapWithBlips(events) {
    const baseMap = buildAsciiMap();
    const lines = baseMap.split('\n');
    // Convert to char arrays for modification
    const grid = lines.map(l => l.split(''));

    const severityChars = {
        CRITICAL: '◉',
        HIGH: '●',
        MEDIUM: '◐',
        LOW: '○',
    };

    const severityColors = {
        CRITICAL: 'var(--critical)',
        HIGH: 'var(--high)',
        MEDIUM: 'var(--medium)',
        LOW: 'var(--low)',
    };

    let blipCount = 0;
    for (const ev of events) {
        if (ev.lat == null || ev.lng == null) continue;
        const { x, y } = projectLatLng(ev.lat, ev.lng, MAP_WIDTH, MAP_HEIGHT);
        // Each Braille char is 2 pixels wide x 4 pixels tall
        // So char position is x/2, y/4
        const charX = Math.floor(x / 2);
        const charY = Math.floor(y / 4);
        if (charY >= 0 && charY < grid.length && charX >= 0 && charX < grid[charY].length) {
            const ch = severityChars[ev.severity] || '○';
            grid[charY][charX] = ch;
            blipCount++;
        }
    }

    // Build colored output
    let result = '';
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const ch = grid[y][x];
            if (ch === '◉') {
                result += `<span class="blip" style="color:var(--critical)">◉</span>`;
            } else if (ch === '●') {
                result += `<span class="blip" style="color:var(--high)">●</span>`;
            } else if (ch === '◐') {
                result += `<span class="blip" style="color:var(--medium)">◐</span>`;
            } else if (ch === '○') {
                result += `<span class="blip" style="color:var(--low)">○</span>`;
            } else {
                result += ch;
            }
        }
        result += '\n';
    }

    return { html: result, blipCount };
}

// Also try to load and use topojson if available
export async function buildAsciiMapFromTopojson() {
    try {
        const resp = await fetch('/data/world-110m.json');
        if (!resp.ok) throw new Error('Failed to load topojson');
        const topo = await resp.json();

        // Simple topojson to grid conversion
        // Extract country polygons and rasterize them
        const grid = new Array(MAP_WIDTH * MAP_HEIGHT).fill(false);

        // Get the first object layer (countries)
        const keys = Object.keys(topo.objects);
        if (keys.length === 0) return buildAsciiMap();

        // Decode arcs
        const arcs = topo.arcs;
        const transform = topo.transform || { scale: [1, 1], translate: [0, 0] };

        function decodeArc(arcIndex) {
            const arc = arcs[arcIndex < 0 ? ~arcIndex : arcIndex];
            const coords = [];
            let x = 0, y = 0;
            for (const [dx, dy] of arc) {
                x += dx;
                y += dy;
                const tx = x * transform.scale[0] + transform.translate[0];
                const ty = y * transform.scale[1] + transform.translate[1];
                if (arcIndex < 0) {
                    coords.unshift([tx, ty]);
                } else {
                    coords.push([tx, ty]);
                }
            }
            return coords;
        }

        function getGeom(geom) {
            if (geom.type === 'Polygon') {
                return [geom.arcs.map(ring => Array.isArray(ring) ? ring.map(decodeArc) : decodeArc(ring))];
            } else if (geom.type === 'MultiPolygon') {
                return geom.arcs.map(poly => poly.map(ring => Array.isArray(ring) ? ring.map(decodeArc) : decodeArc(ring)));
            }
            return [];
        }

        function pointInPolygonLngLat(lng, lat, polygon) {
            // polygon is array of rings, first is outer, rest are holes
            let inside = false;
            for (const ring of polygon) {
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                    const xi = ring[i][0], yi = ring[i][1];
                    const xj = ring[j][0], yj = ring[j][1];
                    if (((yi > lat) !== (yj > lat)) &&
                        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                        inside = !inside;
                    }
                }
            }
            return inside;
        }

        // Process each country
        for (const key of keys) {
            const obj = topo.objects[key];
            if (!obj.geometries) continue;
            for (const geom of obj.geometries) {
                const polygons = getGeom(geom);
                for (const polygon of polygons) {
                    for (let py = 0; py < MAP_HEIGHT; py++) {
                        for (let px = 0; px < MAP_WIDTH; px++) {
                            const lng = (px / MAP_WIDTH) * 360 - 180;
                            const lat = 90 - (py / MAP_HEIGHT) * 180;
                            if (!grid[py * MAP_WIDTH + px]) {
                                if (pointInPolygonLngLat(lng, lat, polygon)) {
                                    grid[py * MAP_WIDTH + px] = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check if we got any land
        let landCount = grid.filter(c => c).length;
        if (landCount < 100) {
            // Topojson parsing might have failed, fall back to procedural map
            return buildAsciiMap();
        }

        const mapStr = gridToBraille(grid, MAP_WIDTH, MAP_HEIGHT);
        cachedMapString = mapStr;
        return mapStr;
    } catch (e) {
        console.warn('[CLERMONT] Topojson load failed, using procedural map:', e.message);
        return buildAsciiMap();
    }
}