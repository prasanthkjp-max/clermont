// mock-data.js — Fallback mock data for offline/degraded mode

export const MOCK_EVENTS = [
    // GEO
    {id:"geo-001",feed:"GEO",title:"MILITARY BUILDUP REPORTED — EASTERN UKRAINE BORDER",severity:"CRITICAL",lat:49.8,lng:36.2,timestamp:new Date().toISOString(),source:"AP/REUTERS",url:"https://example.com/1"},
    {id:"geo-002",feed:"GEO",title:"SANCTIONS IMPOSED — TRADE RESTRICTIONS EXPANDED",severity:"HIGH",lat:39.9,lng:116.4,timestamp:new Date().toISOString(),source:"BLOOMBERG",url:"https://example.com/2"},
    {id:"geo-003",feed:"GEO",title:"DIPLOMATIC SUMMIT SCHEDULED — PEACE TALKS",severity:"MEDIUM",lat:41.9,lng:12.5,timestamp:new Date().toISOString(),source:"REUTERS",url:"https://example.com/3"},
    {id:"geo-004",feed:"GEO",title:"ELECTIONS ANNOUNCED — TRANSITION GOVERNMENT",severity:"MEDIUM",lat:-1.3,lng:36.8,timestamp:new Date().toISOString(),source:"AP",url:"https://example.com/4"},
    {id:"geo-005",feed:"GEO",title:"PROTESTS CONTINUE — CAPITAL CITY",severity:"HIGH",lat:30.0,lng:31.2,timestamp:new Date().toISOString(),source:"AL JAZEERA",url:"https://example.com/5"},
    {id:"geo-006",feed:"GEO",title:"NAVAL EXERCISES — SOUTH CHINA SEA",severity:"HIGH",lat:15.0,lng:115.0,timestamp:new Date().toISOString(),source:"REUTERS",url:"https://example.com/6"},
    {id:"geo-007",feed:"GEO",title:"TREATY SIGNING — ARMS REDUCTION AGREEMENT",severity:"LOW",lat:55.7,lng:37.6,timestamp:new Date().toISOString(),source:"TASS",url:"https://example.com/7"},
    {id:"geo-008",feed:"GEO",title:"BORDER TENSIONS — MILITARY ALERT",severity:"CRITICAL",lat:34.0,lng:74.0,timestamp:new Date().toISOString(),source:"AP",url:"https://example.com/8"},
    // ENV
    {id:"env-001",feed:"ENV",title:"EARTHQUAKE M6.2 — 45KM NW OF RABAUL, PNG",severity:"CRITICAL",lat:-4.2,lng:152.5,timestamp:new Date().toISOString(),source:"USGS",url:"https://earthquake.usgs.gov"},
    {id:"env-002",feed:"ENV",title:"EARTHQUAKE M5.4 — OFF COAST OF CHILE",severity:"HIGH",lat:-30.0,lng:-71.5,timestamp:new Date().toISOString(),source:"USGS",url:"https://earthquake.usgs.gov"},
    {id:"env-003",feed:"ENV",title:"FLASH FLOOD WARNING — CENTRAL TEXAS",severity:"HIGH",lat:31.0,lng:-97.5,timestamp:new Date().toISOString(),source:"NOAA/NWS",url:"https://weather.gov"},
    {id:"env-004",feed:"ENV",title:"TORNADO WARNING — SOUTHWEST OKLAHOMA",severity:"CRITICAL",lat:35.0,lng:-98.5,timestamp:new Date().toISOString(),source:"NOAA/NWS",url:"https://weather.gov"},
    {id:"env-005",feed:"ENV",title:"EARTHQUAKE M4.8 — SOUTHERN CALIFORNIA",severity:"MEDIUM",lat:33.8,lng:-118.2,timestamp:new Date().toISOString(),source:"USGS",url:"https://earthquake.usgs.gov"},
    {id:"env-006",feed:"ENV",title:"WINTER STORM WARNING — NORTHEAST US",severity:"MEDIUM",lat:42.4,lng:-71.1,timestamp:new Date().toISOString(),source:"NOAA/NWS",url:"https://weather.gov"},
    {id:"env-007",feed:"ENV",title:"EARTHQUAKE M7.1 — NEAR EAST COAST OF HONSHU, JAPAN",severity:"CRITICAL",lat:38.3,lng:142.4,timestamp:new Date().toISOString(),source:"USGS",url:"https://earthquake.usgs.gov"},
    {id:"env-008",feed:"ENV",title:"VOLCANIC ERUPTION — KILAUEA, HAWAII",severity:"HIGH",lat:19.4,lng:-155.3,timestamp:new Date().toISOString(),source:"USGS",url:"https://volcanoes.usgs.gov"},
    // MKT
    {id:"mkt-001",feed:"MKT",title:"BTC $67,432 ▲ 2.3% 24H",severity:"MEDIUM",lat:null,lng:null,timestamp:new Date().toISOString(),source:"COINGECKO",url:"https://coingecko.com"},
    {id:"mkt-002",feed:"MKT",title:"ETH $3,521 ▼ -1.2% 24H",severity:"MEDIUM",lat:null,lng:null,timestamp:new Date().toISOString(),source:"COINGECKO",url:"https://coingecko.com"},
    {id:"mkt-003",feed:"MKT",title:"S&P 500 5,234.18 ▲ 0.85%",severity:"LOW",lat:41.0,lng:-74.0,timestamp:new Date().toISOString(),source:"SIMULATED",url:""},
    {id:"mkt-004",feed:"MKT",title:"NASDAQ 16,384.47 ▼ -1.5%",severity:"HIGH",lat:37.8,lng:-122.4,timestamp:new Date().toISOString(),source:"SIMULATED",url:""},
    {id:"mkt-005",feed:"MKT",title:"VIX 28.4 — ELEVATED VOLATILITY",severity:"HIGH",lat:41.0,lng:-74.0,timestamp:new Date().toISOString(),source:"SIMULATED",url:""},
    {id:"mkt-006",feed:"MKT",title:"NIKKEI 38,256.44 ▲ 1.2%",severity:"LOW",lat:35.7,lng:139.7,timestamp:new Date().toISOString(),source:"SIMULATED",url:""},
    // INF
    {id:"inf-001",feed:"INF",title:"BREAKING: MAJOR DEVELOPMENT IN ONGOING CONFLICT",severity:"CRITICAL",lat:null,lng:null,timestamp:new Date().toISOString(),source:"REUTERS",url:"https://reuters.com"},
    {id:"inf-002",feed:"INF",title:"EMERGENCY DECLARED AFTER SEVERE WEATHER EVENT",severity:"HIGH",lat:null,lng:null,timestamp:new Date().toISOString(),source:"AP",url:"https://apnews.com"},
    {id:"inf-003",feed:"INF",title:"WORLD LEADERS GATHER FOR CLIMATE SUMMIT",severity:"MEDIUM",lat:null,lng:null,timestamp:new Date().toISOString(),source:"BBC",url:"https://bbc.com"},
    {id:"inf-004",feed:"INF",title:"MARKETS RALLY ON POLICY ANNOUNCEMENT",severity:"LOW",lat:null,lng:null,timestamp:new Date().toISOString(),source:"BLOOMBERG",url:"https://bloomberg.com"},
    {id:"inf-005",feed:"INF",title:"HUMANITARIAN CRISIS DEEPENS IN REGION",severity:"HIGH",lat:null,lng:null,timestamp:new Date().toISOString(),source:"AL JAZEERA",url:"https://aljazeera.com"},
    {id:"inf-006",feed:"INF",title:"DIPLOMATIC RELATIONS RESTORED AFTER TALKS",severity:"MEDIUM",lat:null,lng:null,timestamp:new Date().toISOString(),source:"REUTERS",url:"https://reuters.com"},
    {id:"inf-007",feed:"INF",title:"MAJOR EARTHQUAKE TRIGGERS TSUNAMI WARNING",severity:"CRITICAL",lat:null,lng:null,timestamp:new Date().toISOString(),source:"AP",url:"https://apnews.com"},
];