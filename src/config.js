// ---------------------------------------------------------------------------
// Zentrale Konfiguration – hier pflegt die Firma Preise, Materialien & Optionen.
// Alle Größen in mm, Preise netto in EUR.
// ---------------------------------------------------------------------------

export const CONFIG = {
  company: {
    name: 'XL Print Studio',
    email: 'anfrage@example.com', // Empfänger für "Angebot anfragen"
  },

  currency: 'EUR',
  locale: 'de-DE',
  vat: 0.19,

  // Maximaler Bauraum (Breite x Tiefe x Höhe). Ein Material kann über
  // `maxSize` einen eigenen, kleineren Bauraum bekommen.
  buildVolume: [1000, 1000, 1000],

  setupFee: 25,          // einmalig pro Auftrag
  minOrder: 49,          // Mindestauftragswert netto
  machineRatePerHour: 8, // Maschinenstundensatz
  wallThicknessMm: 2.4,  // angenommene Wandstärke (Perimeter) für die Volumenschätzung
  supportFactor: 0.12,   // +12 % Material/Zeit für Stützstrukturen

  maxUploadMb: 150,

  materials: [
    {
      id: 'pla',
      name: 'PLA',
      tag: 'Bestseller',
      description: 'Günstig, formstabil, ideal für Deko, Displays & Prototypen.',
      density: 1.24,          // g/cm³
      pricePerKg: 30,
      throughputCm3h: 120,    // Druckleistung bei Standardqualität
      roughness: 0.55,
      colors: [
        { name: 'Weiß', hex: '#f1f1ee' },
        { name: 'Schwarz', hex: '#2a2a2c' },
        { name: 'Grau', hex: '#8a9099' },
        { name: 'Rot', hex: '#c8302c' },
        { name: 'Blau', hex: '#2a5db0' },
        { name: 'Grün', hex: '#3d8b4f' },
      ],
    },
    {
      id: 'petg',
      name: 'PETG',
      tag: 'Robust',
      description: 'Schlagzäh, chemikalien- und feuchtigkeitsbeständig.',
      density: 1.27,
      pricePerKg: 34,
      throughputCm3h: 100,
      roughness: 0.35,
      colors: [
        { name: 'Transparent', hex: '#cfe3ea' },
        { name: 'Schwarz', hex: '#2a2a2c' },
        { name: 'Weiß', hex: '#f1f1ee' },
        { name: 'Orange', hex: '#e2742b' },
      ],
    },
    {
      id: 'asa',
      name: 'ASA',
      tag: 'Outdoor',
      description: 'UV- und witterungsbeständig – für Außenbereich & Fahrzeugteile.',
      density: 1.07,
      pricePerKg: 42,
      throughputCm3h: 90,
      roughness: 0.6,
      colors: [
        { name: 'Schwarz', hex: '#2a2a2c' },
        { name: 'Weiß', hex: '#f1f1ee' },
        { name: 'Anthrazit', hex: '#4a4f55' },
      ],
    },
    {
      id: 'tpu',
      name: 'TPU 95A',
      tag: 'Flexibel',
      description: 'Gummiartig und elastisch – Dichtungen, Puffer, Griffe.',
      density: 1.21,
      pricePerKg: 55,
      throughputCm3h: 40,
      roughness: 0.8,
      colors: [
        { name: 'Schwarz', hex: '#2a2a2c' },
        { name: 'Rot', hex: '#c8302c' },
      ],
    },
    {
      id: 'pacf',
      name: 'PA-CF',
      tag: 'Hochfest',
      description: 'Carbonfaserverstärktes Nylon – steif, leicht, technisch.',
      density: 1.18,
      pricePerKg: 95,
      throughputCm3h: 60,
      roughness: 0.85,
      colors: [{ name: 'Carbon-Schwarz', hex: '#1f2022' }],
    },
    {
      id: 'resin',
      name: 'Resin',
      tag: 'Detailreich',
      description: 'Glatte Oberflächen und feinste Details. Wird immer massiv gedruckt.',
      density: 1.15,
      pricePerKg: 70,
      throughputCm3h: 60,
      roughness: 0.25,
      solid: true, // Füllgrad nicht wählbar
      colors: [
        { name: 'Grau', hex: '#9a9ea3' },
        { name: 'Weiß', hex: '#f1f1ee' },
        { name: 'Schwarz', hex: '#2a2a2c' },
      ],
    },
  ],

  infill: [
    { id: 'light', label: 'Leicht', detail: '15 %', value: 0.15 },
    { id: 'standard', label: 'Standard', detail: '25 %', value: 0.25 },
    { id: 'strong', label: 'Stabil', detail: '50 %', value: 0.5 },
    { id: 'solid', label: 'Massiv', detail: '100 %', value: 1 },
  ],

  quality: [
    { id: 'draft', label: 'Grob', detail: '0,6 mm Schicht', speedFactor: 1.6 },
    { id: 'standard', label: 'Standard', detail: '0,4 mm Schicht', speedFactor: 1 },
    { id: 'fine', label: 'Fein', detail: '0,2 mm Schicht', speedFactor: 0.5 },
  ],

  finishing: [
    { id: 'raw', label: 'Roh', detail: 'Stützen entfernt', pricePerCm2: 0 },
    { id: 'sanded', label: 'Geschliffen', detail: 'Schichtlinien geglättet', pricePerCm2: 0.015 },
    { id: 'painted', label: 'Lackiert', detail: 'Grundiert & lackiert', pricePerCm2: 0.05 },
  ],

  // Mengenrabatt: ab `min` Stück gilt `discount`
  quantityDiscounts: [
    { min: 1, discount: 0 },
    { min: 5, discount: 0.05 },
    { min: 10, discount: 0.1 },
    { min: 25, discount: 0.15 },
  ],

  defaults: {
    materialId: 'pla',
    infillId: 'standard',
    qualityId: 'standard',
    finishingId: 'raw',
  },
};
