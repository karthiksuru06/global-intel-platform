/**
 * Global Simulation Data Engine
 * Generates realistic geospatial data for 20+ layer types
 * using approximate real-world coordinates and metadata.
 */

// ============================================================
// MAJOR AIRPORTS (for flight path generation)
// ============================================================
export const AIRPORTS = [
  { code: "JFK", name: "John F. Kennedy Intl", lat: 40.6413, lon: -73.7781, city: "New York" },
  { code: "LAX", name: "Los Angeles Intl", lat: 33.9416, lon: -118.4085, city: "Los Angeles" },
  { code: "LHR", name: "Heathrow", lat: 51.4700, lon: -0.4543, city: "London" },
  { code: "CDG", name: "Charles de Gaulle", lat: 49.0097, lon: 2.5479, city: "Paris" },
  { code: "DXB", name: "Dubai Intl", lat: 25.2532, lon: 55.3657, city: "Dubai" },
  { code: "HND", name: "Haneda", lat: 35.5494, lon: 139.7798, city: "Tokyo" },
  { code: "SIN", name: "Changi", lat: 1.3644, lon: 103.9915, city: "Singapore" },
  { code: "PEK", name: "Beijing Capital", lat: 40.0799, lon: 116.6031, city: "Beijing" },
  { code: "SYD", name: "Kingsford Smith", lat: -33.9399, lon: 151.1753, city: "Sydney" },
  { code: "FRA", name: "Frankfurt", lat: 50.0379, lon: 8.5622, city: "Frankfurt" },
  { code: "AMS", name: "Schiphol", lat: 52.3105, lon: 4.7683, city: "Amsterdam" },
  { code: "ICN", name: "Incheon", lat: 37.4602, lon: 126.4407, city: "Seoul" },
  { code: "DEL", name: "Indira Gandhi", lat: 28.5562, lon: 77.1000, city: "Delhi" },
  { code: "BOM", name: "Chhatrapati Shivaji", lat: 19.0896, lon: 72.8656, city: "Mumbai" },
  { code: "GRU", name: "Guarulhos", lat: -23.4356, lon: -46.4731, city: "São Paulo" },
  { code: "IST", name: "Istanbul", lat: 41.2753, lon: 28.7519, city: "Istanbul" },
  { code: "ORD", name: "O'Hare", lat: 41.9742, lon: -87.9073, city: "Chicago" },
  { code: "ATL", name: "Hartsfield-Jackson", lat: 33.6407, lon: -84.4277, city: "Atlanta" },
  { code: "HKG", name: "Hong Kong Intl", lat: 22.3080, lon: 113.9185, city: "Hong Kong" },
  { code: "BKK", name: "Suvarnabhumi", lat: 13.6900, lon: 100.7501, city: "Bangkok" },
  { code: "DOH", name: "Hamad Intl", lat: 25.2731, lon: 51.6081, city: "Doha" },
  { code: "JNB", name: "O.R. Tambo", lat: -26.1392, lon: 28.2460, city: "Johannesburg" },
  { code: "MEX", name: "Benito Juárez", lat: 19.4363, lon: -99.0721, city: "Mexico City" },
  { code: "NRT", name: "Narita", lat: 35.7720, lon: 140.3929, city: "Tokyo" },
  { code: "MUC", name: "Munich", lat: 48.3537, lon: 11.7750, city: "Munich" },
  { code: "MAD", name: "Barajas", lat: 40.4983, lon: -3.5676, city: "Madrid" },
  { code: "FCO", name: "Fiumicino", lat: 41.8003, lon: 12.2389, city: "Rome" },
  { code: "EZE", name: "Ezeiza", lat: -34.8222, lon: -58.5358, city: "Buenos Aires" },
  { code: "CAI", name: "Cairo Intl", lat: 30.1219, lon: 31.4056, city: "Cairo" },
  { code: "KUL", name: "KLIA", lat: 2.7456, lon: 101.7099, city: "Kuala Lumpur" },
];

// ============================================================
// FLIGHT ROUTES (pairs of airport codes)
// ============================================================
export const FLIGHT_ROUTES = [
  ["JFK", "LHR"], ["LAX", "HND"], ["CDG", "DXB"], ["SIN", "SYD"],
  ["FRA", "PEK"], ["AMS", "ICN"], ["ORD", "LHR"], ["ATL", "CDG"],
  ["HKG", "LAX"], ["BKK", "SYD"], ["DOH", "LHR"], ["JNB", "DXB"],
  ["MEX", "MAD"], ["DEL", "SIN"], ["BOM", "LHR"], ["IST", "JFK"],
  ["GRU", "FRA"], ["CAI", "IST"], ["MUC", "PEK"], ["FCO", "JFK"],
  ["KUL", "HND"], ["NRT", "LAX"], ["EZE", "MAD"], ["ICN", "SIN"],
  ["LHR", "SIN"], ["JFK", "CDG"], ["LAX", "SYD"], ["DXB", "HKG"],
  ["ATL", "FRA"], ["ORD", "HND"], ["DEL", "DXB"], ["BOM", "SIN"],
  ["IST", "DEL"], ["PEK", "LAX"], ["CDG", "ICN"], ["AMS", "JFK"],
];

// ============================================================
// SUBMARINE CABLES (approximate path coordinates)
// ============================================================
export const SUBMARINE_CABLES = [
  {
    name: "TAT-14 (Transatlantic)",
    color: "#22d3ee",
    points: [
      [-73.9, 40.6], [-50, 45], [-30, 48], [-15, 50], [-5, 51], [0, 51.5],
    ],
  },
  {
    name: "SEA-ME-WE 3",
    color: "#06b6d4",
    points: [
      [-5, 36], [10, 35], [25, 33], [32, 31], [34, 28], [38, 22],
      [44, 13], [50, 12], [56, 15], [62, 18], [68, 20], [73, 15],
      [80, 8], [88, 5], [96, 2], [100, 1.3], [104, 1.3], [110, -5],
      [115, -8], [120, -10], [130, -15], [140, -20], [150, -30], [151, -33.9],
    ],
  },
  {
    name: "Pacific Crossing (PC-1)",
    color: "#0891b2",
    points: [
      [-122, 37], [-140, 35], [-155, 30], [-170, 28], [-180, 30],
      [175, 32], [165, 33], [155, 34], [145, 35], [140, 35.5],
    ],
  },
  {
    name: "SAFE (South Africa-Far East)",
    color: "#67e8f9",
    points: [
      [28.2, -26], [30, -30], [35, -33], [45, -30], [55, -20],
      [65, -10], [72, 5], [80, 8], [90, 5], [100, 1.3],
    ],
  },
  {
    name: "IMEWE",
    color: "#a5f3fc",
    points: [
      [12.2, 41.8], [15, 38], [20, 35], [25, 34], [30, 31],
      [32, 30], [34, 27], [38, 22], [44, 13], [55, 25], [60, 24],
      [72, 18], [76, 13],
    ],
  },
  {
    name: "AAE-1 (Asia-Africa-Europe)",
    color: "#22d3ee",
    points: [
      [-5, 36], [2, 37], [10, 38], [18, 36], [25, 35], [30, 33],
      [33, 30], [36, 25], [42, 14], [48, 12], [55, 20], [62, 22],
      [72, 17], [80, 10], [90, 5], [100, 2], [104, 1.3], [110, -2],
      [116, 3], [120, 12], [122, 22],
    ],
  },
  {
    name: "MAREA (Transatlantic)",
    color: "#0ea5e9",
    points: [
      [-73.5, 39], [-55, 40], [-40, 41], [-25, 42], [-15, 42.5], [-5, 43],
    ],
  },
  {
    name: "APCN-2 (Asia Pacific)",
    color: "#38bdf8",
    points: [
      [104, 1.3], [108, 8], [112, 14], [116, 18], [120, 22],
      [122, 25], [126, 33], [127, 37], [130, 35], [135, 35], [140, 35.5],
    ],
  },
];

// ============================================================
// PIPELINES (approximate routes)
// ============================================================
export const PIPELINES = [
  {
    name: "Nord Stream (Baltic Sea)",
    color: "#f59e0b",
    points: [
      [30.2, 59.8], [24, 58], [20, 56], [15, 55], [12.5, 54.5],
    ],
  },
  {
    name: "Trans-Siberian Pipeline",
    color: "#d97706",
    points: [
      [73, 61], [65, 58], [55, 56], [45, 55], [38, 52], [30, 50],
    ],
  },
  {
    name: "Keystone XL",
    color: "#fbbf24",
    points: [
      [-110, 50.5], [-107, 48], [-104, 45], [-100, 42],
      [-97, 40], [-96, 37], [-95, 33], [-95, 30],
    ],
  },
  {
    name: "TAPI (Central Asia)",
    color: "#f59e0b",
    points: [
      [55, 38], [58, 36], [62, 34], [65, 32], [67, 30], [69, 28], [70, 25],
    ],
  },
  {
    name: "BTC (Baku-Tbilisi-Ceyhan)",
    color: "#eab308",
    points: [
      [49.8, 40.4], [47, 41], [44, 41.7], [42, 41.5], [39, 40], [36, 37],
    ],
  },
  {
    name: "Trans-Mediterranean",
    color: "#ca8a04",
    points: [
      [3, 36.5], [5, 37], [8, 38], [10, 37], [12, 38], [14, 40], [16, 41],
    ],
  },
];

// ============================================================
// MILITARY BASES (real approximate locations)
// ============================================================
export const MILITARY_BASES = [
  { name: "Camp Humphreys", lat: 36.9627, lon: 127.0314, country: "South Korea", type: "US Army" },
  { name: "Ramstein AB", lat: 49.4369, lon: 7.6003, country: "Germany", type: "US Air Force" },
  { name: "Yokosuka Naval Base", lat: 35.2836, lon: 139.6667, country: "Japan", type: "US Navy" },
  { name: "Diego Garcia", lat: -7.3195, lon: 72.4229, country: "BIOT", type: "US/UK Joint" },
  { name: "Pine Gap", lat: -23.7990, lon: 133.7370, country: "Australia", type: "US/AUS Intelligence" },
  { name: "RAF Lakenheath", lat: 52.4093, lon: 0.5610, country: "UK", type: "US Air Force" },
  { name: "Guantánamo Bay", lat: 19.9023, lon: -75.0968, country: "Cuba", type: "US Naval Station" },
  { name: "Al Udeid AB", lat: 25.1174, lon: 51.3150, country: "Qatar", type: "US Air Force" },
  { name: "Incirlik AB", lat: 37.0015, lon: 35.4259, country: "Turkey", type: "US/NATO" },
  { name: "Thule AB", lat: 76.5312, lon: -68.7031, country: "Greenland", type: "US Space Force" },
  { name: "NSA Bahrain", lat: 26.2373, lon: 50.6191, country: "Bahrain", type: "US Navy 5th Fleet" },
  { name: "Camp Lemonnier", lat: 11.5478, lon: 43.1547, country: "Djibouti", type: "US Naval Expeditionary" },
  { name: "Kadena AB", lat: 26.3516, lon: 127.7672, country: "Japan", type: "US Air Force" },
  { name: "Fort Liberty", lat: 35.1390, lon: -79.0066, country: "USA", type: "US Army Airborne" },
  { name: "Severomorsk", lat: 69.0731, lon: 33.4218, country: "Russia", type: "Northern Fleet HQ" },
  { name: "Tartus Naval Base", lat: 34.8900, lon: 35.8900, country: "Syria", type: "Russian Navy" },
  { name: "Hainan Naval Base", lat: 18.2100, lon: 109.5100, country: "China", type: "PLAN South Sea Fleet" },
  { name: "Kaliningrad", lat: 54.7104, lon: 20.4522, country: "Russia", type: "Baltic Fleet" },
];

// ============================================================
// NUCLEAR SITES
// ============================================================
export const NUCLEAR_SITES = [
  { name: "Chernobyl (Exclusion Zone)", lat: 51.3892, lon: 30.0988, type: "decommissioned", country: "Ukraine" },
  { name: "Fukushima Daiichi", lat: 37.4211, lon: 141.0328, type: "decommissioned", country: "Japan" },
  { name: "Natanz Enrichment", lat: 33.7240, lon: 51.7274, type: "enrichment", country: "Iran" },
  { name: "Yongbyon", lat: 39.7954, lon: 125.7534, type: "weapons", country: "North Korea" },
  { name: "Dimona", lat: 31.0015, lon: 35.1445, type: "weapons", country: "Israel" },
  { name: "Sellafield", lat: 54.4200, lon: -3.4985, type: "reprocessing", country: "UK" },
  { name: "La Hague", lat: 49.6781, lon: -1.8817, type: "reprocessing", country: "France" },
  { name: "Savannah River", lat: 33.3466, lon: -81.7399, type: "weapons complex", country: "USA" },
  { name: "Los Alamos", lat: 35.8440, lon: -106.2873, type: "research lab", country: "USA" },
  { name: "Barakah", lat: 23.9700, lon: 52.2600, type: "power plant", country: "UAE" },
  { name: "Zaporizhzhia NPP", lat: 47.5070, lon: 34.5854, type: "power plant (conflict zone)", country: "Ukraine" },
  { name: "Kudankulam", lat: 8.1660, lon: 77.7083, type: "power plant", country: "India" },
  { name: "Hinkley Point C", lat: 51.2076, lon: -3.1308, type: "under construction", country: "UK" },
];

// ============================================================
// CONFLICT ZONES
// ============================================================
export const CONFLICT_ZONES = [
  { name: "Ukraine-Russia Front", lat: 48.5, lon: 37.5, severity: 5, type: "Interstate war" },
  { name: "Gaza", lat: 31.35, lon: 34.31, severity: 5, type: "Armed conflict" },
  { name: "Sudan Civil War", lat: 15.5, lon: 32.5, severity: 5, type: "Civil war" },
  { name: "Myanmar", lat: 19.0, lon: 96.0, severity: 4, type: "Civil war" },
  { name: "Sahel Region", lat: 14.5, lon: 1.0, severity: 4, type: "Insurgency" },
  { name: "Eastern DRC", lat: -1.5, lon: 29.0, severity: 4, type: "Armed conflict" },
  { name: "Somalia / Al-Shabaab", lat: 2.0, lon: 45.0, severity: 4, type: "Insurgency" },
  { name: "Syria (residual)", lat: 35.0, lon: 38.5, severity: 3, type: "Residual conflict" },
  { name: "Ethiopia (Amhara)", lat: 11.5, lon: 38.0, severity: 3, type: "Internal conflict" },
  { name: "Mozambique (Cabo Delgado)", lat: -12.5, lon: 40.0, severity: 3, type: "Insurgency" },
  { name: "Colombia (ELN)", lat: 7.0, lon: -73.0, severity: 2, type: "Guerrilla activity" },
  { name: "Haiti (Gang Violence)", lat: 18.5, lon: -72.3, severity: 3, type: "Urban conflict" },
  { name: "Yemen (Houthi)", lat: 15.5, lon: 44.0, severity: 4, type: "Civil war" },
  { name: "Nagorno-Karabakh (post)", lat: 39.8, lon: 46.8, severity: 2, type: "Post-conflict tension" },
  { name: "Taiwan Strait Tension", lat: 24.5, lon: 118.5, severity: 2, type: "Geopolitical hotspot" },
];

// ============================================================
// DATA CENTERS
// ============================================================
export const DATA_CENTERS = [
  { name: "AWS US-East-1", lat: 39.0438, lon: -77.4874, provider: "Amazon", city: "Ashburn, VA" },
  { name: "Google The Dalles", lat: 45.5946, lon: -121.1787, provider: "Google", city: "The Dalles, OR" },
  { name: "Microsoft Dublin", lat: 53.3498, lon: -6.2603, provider: "Microsoft", city: "Dublin" },
  { name: "Equinix SG3", lat: 1.3521, lon: 103.8198, provider: "Equinix", city: "Singapore" },
  { name: "AWS Frankfurt", lat: 50.1109, lon: 8.6821, provider: "Amazon", city: "Frankfurt" },
  { name: "Google Taiwan", lat: 24.0748, lon: 120.5340, provider: "Google", city: "Changhua" },
  { name: "Meta Luleå", lat: 65.5848, lon: 22.1547, provider: "Meta", city: "Luleå, Sweden" },
  { name: "Alibaba Hangzhou", lat: 30.2741, lon: 120.1551, provider: "Alibaba", city: "Hangzhou" },
  { name: "Oracle Tokyo", lat: 35.6762, lon: 139.6503, provider: "Oracle", city: "Tokyo" },
  { name: "Digital Realty London", lat: 51.5224, lon: -0.0708, provider: "Digital Realty", city: "London" },
  { name: "CoreSite LA", lat: 34.0407, lon: -118.2468, provider: "CoreSite", city: "Los Angeles" },
  { name: "NTT Mumbai", lat: 19.0760, lon: 72.8777, provider: "NTT", city: "Mumbai" },
];

// ============================================================
// SPACEPORTS
// ============================================================
export const SPACEPORTS = [
  { name: "Kennedy Space Center", lat: 28.5729, lon: -80.6490, country: "USA", operator: "NASA/SpaceX" },
  { name: "Baikonur Cosmodrome", lat: 45.9646, lon: 63.3052, country: "Kazakhstan", operator: "Roscosmos" },
  { name: "Vandenberg SFB", lat: 34.7420, lon: -120.5724, country: "USA", operator: "SpaceX/USSF" },
  { name: "Guiana Space Centre", lat: 5.2322, lon: -52.7693, country: "French Guiana", operator: "ESA/Arianespace" },
  { name: "Jiuquan", lat: 40.9580, lon: 100.2913, country: "China", operator: "CNSA" },
  { name: "Satish Dhawan", lat: 13.7199, lon: 80.2304, country: "India", operator: "ISRO" },
  { name: "Tanegashima", lat: 30.4000, lon: 130.9700, country: "Japan", operator: "JAXA" },
  { name: "Plesetsk", lat: 62.9271, lon: 40.5781, country: "Russia", operator: "Russian MoD" },
  { name: "Wenchang", lat: 19.6145, lon: 110.9510, country: "China", operator: "CNSA" },
  { name: "Starbase (Boca Chica)", lat: 25.9974, lon: -97.1561, country: "USA", operator: "SpaceX" },
];

// ============================================================
// CYBER THREATS (simulated origins)
// ============================================================
export const CYBER_THREAT_ORIGINS = [
  { name: "APT28 / Fancy Bear", lat: 55.7558, lon: 37.6173, origin: "Moscow, Russia", type: "State-sponsored APT" },
  { name: "APT41 / Double Dragon", lat: 39.9042, lon: 116.4074, origin: "Beijing, China", type: "State-sponsored APT" },
  { name: "Lazarus Group", lat: 39.0392, lon: 125.7625, origin: "Pyongyang, DPRK", type: "State-sponsored APT" },
  { name: "Charming Kitten", lat: 35.6892, lon: 51.3890, origin: "Tehran, Iran", type: "State-sponsored APT" },
  { name: "Sandworm", lat: 55.7558, lon: 37.6173, origin: "GRU, Russia", type: "Destructive ops" },
  { name: "DarkSide Ransomware", lat: 47.4979, lon: 19.0402, origin: "Eastern Europe", type: "Ransomware" },
  { name: "REvil / Sodinokibi", lat: 50.4501, lon: 30.5234, origin: "Ukraine/Russia", type: "RaaS" },
  { name: "LockBit 3.0", lat: 55.0084, lon: 82.9357, origin: "Distributed", type: "Ransomware-as-a-Service" },
];

// ============================================================
// PROTESTS / CIVIL UNREST (simulated)
// ============================================================
export const PROTEST_LOCATIONS = [
  { name: "Hong Kong Pro-Democracy", lat: 22.3193, lon: 114.1694, severity: 3, type: "Pro-democracy" },
  { name: "Paris Yellow Vests", lat: 48.8566, lon: 2.3522, severity: 2, type: "Economic" },
  { name: "Bangkok Democracy Movement", lat: 13.7563, lon: 100.5018, severity: 3, type: "Pro-democracy" },
  { name: "Tehran Protests", lat: 35.6892, lon: 51.3890, severity: 4, type: "Anti-government" },
  { name: "Nairobi GenZ Protests", lat: -1.2921, lon: 36.8219, severity: 3, type: "Anti-tax" },
  { name: "Buenos Aires March", lat: -34.6037, lon: -58.3816, severity: 2, type: "Economic" },
  { name: "Dhaka Student Movement", lat: 23.8103, lon: 90.4125, severity: 4, type: "Student uprising" },
  { name: "Istanbul Rally", lat: 41.0082, lon: 28.9784, severity: 2, type: "Political" },
  { name: "Lagos EndSARS", lat: 6.5244, lon: 3.3792, severity: 3, type: "Police brutality" },
  { name: "Santiago Plaza Italia", lat: -33.4489, lon: -70.6693, severity: 2, type: "Social inequality" },
];

// ============================================================
// FIRES (wildfire hotspots)
// ============================================================
export const FIRE_HOTSPOTS = [
  { name: "California Wildfire", lat: 36.7783, lon: -119.4179, severity: 4, region: "Western USA" },
  { name: "Amazon Deforestation Fire", lat: -3.4653, lon: -62.2159, severity: 5, region: "Brazil" },
  { name: "Siberian Wildfire", lat: 62.0, lon: 130.0, severity: 4, region: "Russia" },
  { name: "Australian Bushfire", lat: -33.0, lon: 148.0, severity: 4, region: "NSW, Australia" },
  { name: "Canadian Wildfire", lat: 56.0, lon: -120.0, severity: 4, region: "Alberta, Canada" },
  { name: "Greek Wildfire", lat: 38.2, lon: 23.7, severity: 3, region: "Attica, Greece" },
  { name: "Indonesian Peat Fire", lat: -2.5, lon: 111.0, severity: 3, region: "Borneo" },
  { name: "Portuguese Forest Fire", lat: 40.0, lon: -8.0, severity: 3, region: "Central Portugal" },
  { name: "African Savanna Burns", lat: -8.0, lon: 25.0, severity: 3, region: "Central Africa" },
  { name: "Tenerife Wildfire", lat: 28.3, lon: -16.5, severity: 2, region: "Canary Islands" },
];

// ============================================================
// MINERAL DEPOSITS
// ============================================================
export const MINERAL_SITES = [
  { name: "Lithium Triangle", lat: -23.5, lon: -67.5, mineral: "Lithium", country: "Bolivia/Argentina/Chile" },
  { name: "Coltan DRC", lat: -1.8, lon: 28.8, mineral: "Coltan/Tantalum", country: "DRC" },
  { name: "Rare Earth Bayan Obo", lat: 41.8, lon: 110.0, mineral: "Rare Earth Elements", country: "China" },
  { name: "Copper Escondida", lat: -24.3, lon: -69.1, mineral: "Copper", country: "Chile" },
  { name: "Cobalt Katanga", lat: -10.9, lon: 25.9, mineral: "Cobalt", country: "DRC" },
  { name: "Iron Ore Pilbara", lat: -22.3, lon: 118.5, mineral: "Iron Ore", country: "Australia" },
  { name: "Nickel Norilsk", lat: 69.3, lon: 88.2, mineral: "Nickel/Palladium", country: "Russia" },
  { name: "Gold Witwatersrand", lat: -26.2, lon: 27.8, mineral: "Gold", country: "South Africa" },
  { name: "Uranium Aïr", lat: 18.5, lon: 7.9, mineral: "Uranium", country: "Niger" },
  { name: "Bauxite Guinea", lat: 10.5, lon: -12.0, mineral: "Bauxite/Aluminum", country: "Guinea" },
];

// ============================================================
// DISPLACEMENT / REFUGEE ROUTES
// ============================================================
export const DISPLACEMENT_ZONES = [
  { name: "Syrian Refugees (Turkey)", lat: 37.0, lon: 36.0, count: "3.6M", destination: "Turkey" },
  { name: "Ukrainian Refugees (Poland)", lat: 51.0, lon: 21.0, count: "1.6M", destination: "Poland" },
  { name: "Rohingya (Bangladesh)", lat: 21.4, lon: 92.0, count: "930K", destination: "Bangladesh" },
  { name: "Venezuelan Exodus", lat: 7.0, lon: -73.0, count: "7.7M", destination: "Regional" },
  { name: "Sudanese Displacement", lat: 12.0, lon: 30.0, count: "8M+", destination: "Chad/SSudan" },
  { name: "Afghan Refugees (Pakistan)", lat: 33.7, lon: 70.0, count: "1.7M", destination: "Pakistan" },
  { name: "Somali Refugees (Kenya)", lat: 0.0, lon: 40.5, count: "500K", destination: "Kenya" },
  { name: "Central Mediterranean Route", lat: 35.0, lon: 15.0, count: "Ongoing", destination: "EU" },
];

// ============================================================
// TRADE ROUTES
// ============================================================
export const TRADE_ROUTES = [
  {
    name: "Strait of Malacca",
    color: "#14b8a6",
    points: [[95, 5], [100, 2], [103, 1.3], [104, 1.3]],
  },
  {
    name: "Suez Canal Route",
    color: "#2dd4bf",
    points: [[32, 31.3], [33, 30], [34, 28], [36, 25], [40, 18], [44, 12]],
  },
  {
    name: "Panama Canal Route",
    color: "#5eead4",
    points: [[-82, 9.5], [-80, 9], [-79.5, 9], [-78, 8.5]],
  },
  {
    name: "Cape of Good Hope Route",
    color: "#14b8a6",
    points: [[18, -34], [20, -36], [25, -35], [30, -33], [35, -30], [40, -25]],
  },
  {
    name: "Northern Sea Route",
    color: "#99f6e4",
    points: [[33, 70], [50, 72], [70, 73], [90, 74], [110, 73], [130, 72], [150, 70], [170, 68]],
  },
  {
    name: "China-Europe Rail (BRI)",
    color: "#0d9488",
    points: [[116, 40], [105, 42], [87, 44], [68, 42], [55, 40], [45, 42], [35, 45], [25, 48], [15, 50], [8, 50]],
  },
];

// ============================================================
// WATERWAY CHOKEPOINTS
// ============================================================
export const WATERWAY_CHOKEPOINTS = [
  { name: "Strait of Hormuz", lat: 26.5, lon: 56.3, traffic: "~21M bbl/day oil" },
  { name: "Strait of Malacca", lat: 2.5, lon: 101.5, traffic: "~16M bbl/day oil" },
  { name: "Suez Canal", lat: 30.5, lon: 32.3, traffic: "12% global trade" },
  { name: "Panama Canal", lat: 9.1, lon: -79.7, traffic: "6% global trade" },
  { name: "Bab el-Mandeb", lat: 12.6, lon: 43.3, traffic: "~6.2M bbl/day oil" },
  { name: "Turkish Straits", lat: 41.1, lon: 29.0, traffic: "~3M bbl/day oil" },
  { name: "Danish Straits", lat: 55.6, lon: 11.0, traffic: "Baltic trade" },
  { name: "Cape of Good Hope", lat: -34.4, lon: 18.5, traffic: "Alt. Suez route" },
];

// ============================================================
// OUTAGE LOCATIONS (simulated)
// ============================================================
export const OUTAGE_HOTSPOTS = [
  { name: "Ashburn Data Center Cluster", lat: 39.0438, lon: -77.4874, type: "Internet", severity: 3 },
  { name: "Texas Power Grid", lat: 31.0, lon: -100.0, type: "Power", severity: 4 },
  { name: "London IX", lat: 51.5, lon: -0.1, type: "Internet Exchange", severity: 2 },
  { name: "India Northern Grid", lat: 28.6, lon: 77.2, type: "Power", severity: 3 },
  { name: "Brazil SE Grid", lat: -23.5, lon: -46.6, type: "Power", severity: 2 },
  { name: "South Africa Load Shedding", lat: -26.2, lon: 28.0, type: "Power", severity: 4 },
];

// ============================================================
// CLIMATE ANOMALIES
// ============================================================
export const CLIMATE_EVENTS = [
  { name: "Arctic Sea Ice Loss", lat: 80.0, lon: 0.0, type: "Ice melt", severity: 4 },
  { name: "Coral Bleaching GBR", lat: -18.0, lon: 147.0, type: "Ocean warming", severity: 4 },
  { name: "Sahel Desertification", lat: 14.0, lon: 2.0, type: "Desertification", severity: 3 },
  { name: "Antarctic Ice Shelf", lat: -75.0, lon: -60.0, type: "Ice shelf collapse", severity: 4 },
  { name: "Permafrost Thaw Siberia", lat: 65.0, lon: 130.0, type: "Permafrost methane", severity: 3 },
  { name: "Amazon Drought", lat: -3.0, lon: -60.0, type: "Drought", severity: 4 },
  { name: "Pacific Marine Heatwave", lat: 30.0, lon: -150.0, type: "Marine heatwave", severity: 3 },
  { name: "Himalayan Glacier Retreat", lat: 28.0, lon: 86.7, type: "Glacier loss", severity: 3 },
];

// ============================================================
// HELPER: Generate great circle arc between two points
// ============================================================
export function generateGreatCircleArc(start, end, numPoints = 50) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(start.lat), lon1 = toRad(start.lon);
  const lat2 = toRad(end.lat), lon2 = toRad(end.lon);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    // Parabolic altitude curve peaking at midpoint
    const alt = Math.sin(f * Math.PI) * 11000; // peak at ~11km (cruising altitude)
    points.push({ lat, lon, alt });
  }
  return points;
}

// ============================================================
// HELPER: Generate random jitter around a point
// ============================================================
export function jitter(val, range = 0.5) {
  return val + (Math.random() - 0.5) * 2 * range;
}

// ============================================================
// MASTER: Generate all simulation events
// ============================================================
let eventCounter = 0;

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${++eventCounter}`;
}

export function generateSimulationEvents() {
  const now = new Date().toISOString();
  const events = [];

  // Military bases
  MILITARY_BASES.forEach((base) => {
    events.push({
      id: makeId("base"),
      type: "bases",
      lat: base.lat,
      lon: base.lon,
      altitude: 0,
      severity: 2,
      timestamp: now,
      source: "mil-intel",
      metadata: { name: base.name, country: base.country, base_type: base.type },
    });
  });

  // Nuclear sites
  NUCLEAR_SITES.forEach((site) => {
    events.push({
      id: makeId("nuke"),
      type: "nuclear",
      lat: site.lat,
      lon: site.lon,
      altitude: 0,
      severity: site.type === "weapons" ? 5 : 3,
      timestamp: now,
      source: "iaea-intel",
      metadata: { name: site.name, facility_type: site.type, country: site.country },
    });
  });

  // Conflicts
  CONFLICT_ZONES.forEach((zone) => {
    events.push({
      id: makeId("conflict"),
      type: "conflicts",
      lat: jitter(zone.lat, 0.3),
      lon: jitter(zone.lon, 0.3),
      altitude: 0,
      severity: zone.severity,
      timestamp: now,
      source: "ucdp-acled",
      metadata: { name: zone.name, conflict_type: zone.type },
    });
  });

  // Data centers
  DATA_CENTERS.forEach((dc) => {
    events.push({
      id: makeId("dc"),
      type: "datacenters",
      lat: dc.lat,
      lon: dc.lon,
      altitude: 0,
      severity: 1,
      timestamp: now,
      source: "infra-intel",
      metadata: { name: dc.name, provider: dc.provider, city: dc.city },
    });
  });

  // Spaceports
  SPACEPORTS.forEach((sp) => {
    events.push({
      id: makeId("space"),
      type: "spaceports",
      lat: sp.lat,
      lon: sp.lon,
      altitude: 0,
      severity: 2,
      timestamp: now,
      source: "space-intel",
      metadata: { name: sp.name, operator: sp.operator, country: sp.country },
    });
  });

  // Cyber threats
  CYBER_THREAT_ORIGINS.forEach((ct) => {
    events.push({
      id: makeId("cyber"),
      type: "cyberThreats",
      lat: jitter(ct.lat, 0.5),
      lon: jitter(ct.lon, 0.5),
      altitude: 0,
      severity: 4,
      timestamp: now,
      source: "threat-intel",
      metadata: { name: ct.name, origin: ct.origin, threat_type: ct.type },
    });
  });

  // Protests
  PROTEST_LOCATIONS.forEach((p) => {
    events.push({
      id: makeId("protest"),
      type: "protests",
      lat: jitter(p.lat, 0.1),
      lon: jitter(p.lon, 0.1),
      altitude: 0,
      severity: p.severity,
      timestamp: now,
      source: "osint",
      metadata: { name: p.name, protest_type: p.type },
    });
  });

  // Fires
  FIRE_HOTSPOTS.forEach((f) => {
    events.push({
      id: makeId("fire"),
      type: "fires",
      lat: jitter(f.lat, 1.0),
      lon: jitter(f.lon, 1.0),
      altitude: 0,
      severity: f.severity,
      timestamp: now,
      source: "firms-nasa",
      metadata: { name: f.name, region: f.region },
    });
  });

  // Minerals
  MINERAL_SITES.forEach((m) => {
    events.push({
      id: makeId("mineral"),
      type: "minerals",
      lat: m.lat,
      lon: m.lon,
      altitude: 0,
      severity: 2,
      timestamp: now,
      source: "usgs-intel",
      metadata: { name: m.name, mineral: m.mineral, country: m.country },
    });
  });

  // Displacement
  DISPLACEMENT_ZONES.forEach((d) => {
    events.push({
      id: makeId("displace"),
      type: "displacement",
      lat: d.lat,
      lon: d.lon,
      altitude: 0,
      severity: 4,
      timestamp: now,
      source: "unhcr",
      metadata: { name: d.name, displaced_count: d.count, destination: d.destination },
    });
  });

  // Waterway chokepoints
  WATERWAY_CHOKEPOINTS.forEach((w) => {
    events.push({
      id: makeId("water"),
      type: "waterways",
      lat: w.lat,
      lon: w.lon,
      altitude: 0,
      severity: 2,
      timestamp: now,
      source: "maritime-intel",
      metadata: { name: w.name, daily_traffic: w.traffic },
    });
  });

  // Outages
  OUTAGE_HOTSPOTS.forEach((o) => {
    events.push({
      id: makeId("outage"),
      type: "outages",
      lat: jitter(o.lat, 0.3),
      lon: jitter(o.lon, 0.3),
      altitude: 0,
      severity: o.severity,
      timestamp: now,
      source: "downdetector",
      metadata: { name: o.name, outage_type: o.type },
    });
  });

  // Climate
  CLIMATE_EVENTS.forEach((c) => {
    events.push({
      id: makeId("climate"),
      type: "climate",
      lat: c.lat,
      lon: c.lon,
      altitude: 0,
      severity: c.severity,
      timestamp: now,
      source: "noaa-copernicus",
      metadata: { name: c.name, event_type: c.type },
    });
  });

  // Natural disasters (simulated)
  const naturalDisasters = [
    { name: "Typhoon Pacific", lat: 20, lon: 135, severity: 4, type: "Typhoon" },
    { name: "Earthquake Chile", lat: -33, lon: -71, severity: 3, type: "Earthquake" },
    { name: "Flood Bangladesh", lat: 23.5, lon: 90.0, severity: 4, type: "Flood" },
    { name: "Volcanic Activity Iceland", lat: 63.5, lon: -19.0, severity: 3, type: "Volcanic" },
    { name: "Hurricane Atlantic", lat: 25, lon: -60, severity: 4, type: "Hurricane" },
  ];
  naturalDisasters.forEach((n) => {
    events.push({
      id: makeId("natural"),
      type: "natural",
      lat: jitter(n.lat, 0.5),
      lon: jitter(n.lon, 0.5),
      altitude: 0,
      severity: n.severity,
      timestamp: now,
      source: "noaa-jma",
      metadata: { name: n.name, disaster_type: n.type },
    });
  });

  // Military activity (simulated)
  const militaryActivity = [
    { name: "NATO Exercise Baltic", lat: 56, lon: 18, severity: 2 },
    { name: "PLA Navy SCS Patrol", lat: 16, lon: 112, severity: 3 },
    { name: "Russian Strategic Bomber Patrol", lat: 65, lon: 40, severity: 3 },
    { name: "US Carrier Strike Group", lat: 32, lon: 132, severity: 2 },
    { name: "Indian Navy Exercise", lat: 12, lon: 72, severity: 2 },
  ];
  militaryActivity.forEach((m) => {
    events.push({
      id: makeId("mil"),
      type: "military",
      lat: jitter(m.lat, 1),
      lon: jitter(m.lon, 1),
      altitude: 0,
      severity: m.severity,
      timestamp: now,
      source: "mil-osint",
      metadata: { name: m.name, activity: "Active deployment" },
    });
  });

  // Sanctions (simulated entity locations)
  const sanctionedEntities = [
    { name: "DPRK Regime", lat: 39.0, lon: 125.7, regime: "UN/US/EU" },
    { name: "Iran IRGC", lat: 35.7, lon: 51.4, regime: "US/EU" },
    { name: "Russian Oligarchs", lat: 55.8, lon: 37.6, regime: "US/EU/UK" },
    { name: "Syria Regime", lat: 33.5, lon: 36.3, regime: "US/EU" },
    { name: "Myanmar Military", lat: 19.8, lon: 96.2, regime: "US/EU/UK" },
  ];
  sanctionedEntities.forEach((s) => {
    events.push({
      id: makeId("sanction"),
      type: "sanctions",
      lat: s.lat,
      lon: s.lon,
      altitude: 0,
      severity: 3,
      timestamp: now,
      source: "ofac-eu",
      metadata: { name: s.name, sanctions_regime: s.regime },
    });
  });

  // Hotspots (auto-generated from high-severity clusters)
  const hotspots = [
    { lat: 48.5, lon: 37.5, name: "Eastern Ukraine Hotspot" },
    { lat: 31.4, lon: 34.3, name: "Gaza Hotspot" },
    { lat: 15.5, lon: 32.5, name: "Sudan Hotspot" },
    { lat: 9.0, lon: -79.5, name: "Panama Maritime Hotspot" },
    { lat: 26.5, lon: 56.3, name: "Hormuz Strait Hotspot" },
  ];
  hotspots.forEach((h) => {
    events.push({
      id: makeId("hotspot"),
      type: "hotspots",
      lat: h.lat,
      lon: h.lon,
      altitude: 0,
      severity: 5,
      timestamp: now,
      source: "auto-correlation",
      metadata: { name: h.name, detection: "Spatial clustering" },
    });
  });

  return events;
}
