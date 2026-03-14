export type POICategory =
  | 'hospital'
  | 'police'
  | 'fire_station'
  | 'pharmacy'
  | 'emergency_shelter'
  | 'bunker'
  | 'assembly_point'
  | 'weather_shelter'
  | 'shelter'
  | 'water'
  | 'supermarket'
  | 'fuel';

export interface POI {
  id: string;
  lat: number;
  lng: number;
  category: POICategory;
  name: string;
  tags: Record<string, string>;
  fetchedAt: number;
}

export interface CategoryConfig {
  category: POICategory;
  icon: string;
  color: string;
  label: string;
  /** Overpass QL filter fragments — each becomes node[...](bbox);way[...](bbox); */
  overpassFilters: string[];
  /** Return true if an element's tags belong to this category */
  matchTags: (tags: Record<string, string>) => boolean;
}

// ORDER MATTERS — specific shelter subtypes must come before the generic 'shelter'
// so the matcher picks the most specific category first.
export const CATEGORIES: CategoryConfig[] = [
  {
    category: 'hospital',
    icon: '╋',
    color: 'var(--red)',
    label: 'hosp',
    overpassFilters: ['"amenity"="hospital"'],
    matchTags: (t) => t.amenity === 'hospital',
  },
  {
    category: 'police',
    icon: '★',
    color: 'var(--blue)',
    label: 'police',
    overpassFilters: ['"amenity"="police"'],
    matchTags: (t) => t.amenity === 'police',
  },
  {
    category: 'fire_station',
    icon: '▲',
    color: 'var(--amber)',
    label: 'fire',
    overpassFilters: ['"amenity"="fire_station"'],
    matchTags: (t) => t.amenity === 'fire_station',
  },
  {
    category: 'pharmacy',
    icon: '✚',
    color: 'var(--green)',
    label: 'pharm',
    overpassFilters: ['"amenity"="pharmacy"'],
    matchTags: (t) => t.amenity === 'pharmacy',
  },

  // --- shelter subtypes (specific before generic) ---
  {
    category: 'emergency_shelter',
    icon: '⌂',
    color: 'var(--red)',
    label: 'emerg',
    overpassFilters: [
      '"amenity"="shelter"["shelter_type"="emergency"]',
      '"amenity"="social_facility"["social_facility:for"~"homeless|refugee"]',
    ],
    matchTags: (t) =>
      (t.amenity === 'shelter' && t.shelter_type === 'emergency') ||
      (t.amenity === 'social_facility' &&
        /homeless|refugee/.test(t['social_facility:for'] || '')),
  },
  {
    category: 'bunker',
    icon: '⊞',
    color: 'var(--red)',
    label: 'bunker',
    overpassFilters: ['"building"="bunker"', '"military"="bunker"'],
    matchTags: (t) => t.building === 'bunker' || t.military === 'bunker',
  },
  {
    category: 'assembly_point',
    icon: '⊕',
    color: 'var(--amber)',
    label: 'rally',
    overpassFilters: ['"emergency"="assembly_point"'],
    matchTags: (t) => t.emergency === 'assembly_point',
  },
  {
    category: 'weather_shelter',
    icon: '△',
    color: 'var(--green-dim)',
    label: 'cover',
    overpassFilters: [
      '"amenity"="shelter"["shelter_type"="weather_shelter"]',
      '"amenity"="shelter"["shelter_type"="basic_hut"]',
      '"amenity"="shelter"["shelter_type"="lean_to"]',
    ],
    matchTags: (t) =>
      t.amenity === 'shelter' &&
      ['weather_shelter', 'basic_hut', 'lean_to'].includes(t.shelter_type),
  },
  {
    category: 'shelter',
    icon: '⌂',
    color: 'var(--green-dim)',
    label: 'shelter',
    overpassFilters: ['"amenity"="shelter"'],
    matchTags: (t) => t.amenity === 'shelter',
  },
  // --- end shelter subtypes ---

  {
    category: 'water',
    icon: '≈',
    color: 'var(--blue)',
    label: 'water',
    overpassFilters: ['"amenity"="drinking_water"'],
    matchTags: (t) => t.amenity === 'drinking_water',
  },
  {
    category: 'supermarket',
    icon: '■',
    color: 'var(--amber)',
    label: 'market',
    overpassFilters: ['"shop"="supermarket"'],
    matchTags: (t) => t.shop === 'supermarket',
  },
  {
    category: 'fuel',
    icon: '◆',
    color: 'var(--amber)',
    label: 'fuel',
    overpassFilters: ['"amenity"="fuel"'],
    matchTags: (t) => t.amenity === 'fuel',
  },
];

/** Extra detail keys worth surfacing in popups and AI context */
export const SHELTER_DETAIL_KEYS = [
  'shelter_type',
  'capacity',
  'operator',
  'opening_hours',
  'access',
  'description',
  'social_facility:for',
] as const;
