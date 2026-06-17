// ============================================================
// ROKSAL - Katalog WPC profilov, barv in stilov ograj
// Domenske konstante (client-side) - uporabljajo se v komponentah
// ============================================================

// WPC profilni tipi (WoodCore kolekcija)
export type WpcProfile =
  | 'WOODCORE_AMAZON'
  | 'WOODCORE_RUSTIC_OAK'
  | 'WOODCORE_TEAK'
  | 'WOODCORE_WALNUT'
  | 'WOODCORE_GREY'
  | 'WOODCORE_CHARCOAL'
  | 'WOODCORE_OAK'
  | 'WOODCORE_STONE';

// Način montaže
export type MountType = 'V tla (Zgoraj)' | 'Bočno (V fasado)' | 'Vogalni steber' | 'Na stopnice';

// Stil ograje (WPC kategorije)
export type RailingStyle =
  | 'WPC_H_LINE'
  | 'WPC_V_LINE'
  | 'WPC_PANEL'
  | 'WPC_STEKLO'
  | 'WPC_KLASIC'
  | 'WPC_COMBO';

// WPC barva z WoodCore specifikacijo
export interface WpcColor {
  id: WpcProfile;
  name: string;
  nameEn: string;
  hexColor: string;
  description: string;
}

// WPC profil - dimenzije in specifikacije
export interface WpcProfileInfo {
  id: WpcProfile;
  name: string;
  dimensions: string;
  lengthM: number;
  pricePerM2: number;
  category: string;
  weightKgM: number;
  surfaceType: 'Brushed' | 'Smooth' | 'WoodGrain' | 'Embossed';
}

export interface RailingStyleInfo {
  id: RailingStyle;
  name: string;
  description: string;
  pricePerM2: number;
  material: string;
  wpcCompatible: boolean;
}

export interface PriceBreakdown {
  totalArea: number; // m²
  totalMeters: number;
  heightMultiplier: number;
  baseMaterialCost: number;
  mountingLabor: number;
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  vatAmount: number;
  totalWithVat: number;
}

// Vhodni tip za calculatePrice
export interface PriceInput {
  lengthCm: number;
  heightCm: number;
  widthCm: number;
  mountType: MountType;
  railingStyle: RailingStyle;
  discount: number;
  vatRate: number;
}

// ============================================================
// WPC WOODCORE BARVE (8 barv)
// ============================================================
export const WPC_COLORS: WpcColor[] = [
  {
    id: 'WOODCORE_AMAZON',
    name: 'Amazon Wood',
    nameEn: 'Amazon Wood',
    hexColor: '#8B6914',
    description: 'Topel tropski odtenek z izrazito lesno teksturo',
  },
  {
    id: 'WOODCORE_RUSTIC_OAK',
    name: 'Rustic Oak',
    nameEn: 'Rustic Oak',
    hexColor: '#A67B4B',
    description: 'Klasičen hrastov odtenek z rustikalnim značajem',
  },
  {
    id: 'WOODCORE_TEAK',
    name: 'Teak',
    nameEn: 'Teak',
    hexColor: '#B8860B',
    description: 'Eleganten tikov odtenek, priljubljen za balkone',
  },
  {
    id: 'WOODCORE_WALNUT',
    name: 'Walnut',
    nameEn: 'Walnut',
    hexColor: '#5C4033',
    description: 'Temni oreščkov odtenek za premium videz',
  },
  {
    id: 'WOODCORE_GREY',
    name: 'Grey',
    nameEn: 'Grey',
    hexColor: '#808080',
    description: 'Sodobna siva za moderne fasade',
  },
  {
    id: 'WOODCORE_CHARCOAL',
    name: 'Charcoal',
    nameEn: 'Charcoal',
    hexColor: '#36454F',
    description: 'Temno antracitna za Elegantni kontrast',
  },
  {
    id: 'WOODCORE_OAK',
    name: 'Oak',
    nameEn: 'Oak',
    hexColor: '#C8A96E',
    description: 'Svetel hrastov odtenek, naraven videz',
  },
  {
    id: 'WOODCORE_STONE',
    name: 'Stone',
    nameEn: 'Stone',
    hexColor: '#9B8E82',
    description: 'Kamniti odtenek za naravno harmonijo',
  },
];

// ============================================================
// WPC PROFILI - Dimenzije in cene
// ============================================================
export const WPC_PROFILES: WpcProfileInfo[] = [
  {
    id: 'WOODCORE_AMAZON',
    name: 'WoodCore Amazon Wood',
    dimensions: '140×23mm',
    lengthM: 2.2,
    pricePerM2: 89,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'WoodGrain',
  },
  {
    id: 'WOODCORE_RUSTIC_OAK',
    name: 'WoodCore Rustic Oak',
    dimensions: '140×23mm',
    lengthM: 2.2,
    pricePerM2: 89,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'WoodGrain',
  },
  {
    id: 'WOODCORE_TEAK',
    name: 'WoodCore Teak',
    dimensions: '140×23mm',
    lengthM: 4.0,
    pricePerM2: 95,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'WoodGrain',
  },
  {
    id: 'WOODCORE_WALNUT',
    name: 'WoodCore Walnut',
    dimensions: '140×23mm',
    lengthM: 4.0,
    pricePerM2: 95,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'Embossed',
  },
  {
    id: 'WOODCORE_GREY',
    name: 'WoodCore Grey',
    dimensions: '140×23mm',
    lengthM: 2.2,
    pricePerM2: 89,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'Brushed',
  },
  {
    id: 'WOODCORE_CHARCOAL',
    name: 'WoodCore Charcoal',
    dimensions: '140×23mm',
    lengthM: 4.0,
    pricePerM2: 95,
    category: 'Letve vodoravne',
    weightKgM: 2.8,
    surfaceType: 'Embossed',
  },
  {
    id: 'WOODCORE_OAK',
    name: 'WoodCore Oak',
    dimensions: '180×23mm',
    lengthM: 2.2,
    pricePerM2: 105,
    category: 'Letve široke',
    weightKgM: 3.4,
    surfaceType: 'WoodGrain',
  },
  {
    id: 'WOODCORE_STONE',
    name: 'WoodCore Stone',
    dimensions: '180×23mm',
    lengthM: 4.0,
    pricePerM2: 112,
    category: 'Letve široke',
    weightKgM: 3.4,
    surfaceType: 'Smooth',
  },
];

// ============================================================
// STILOVI OGRAJ (WPC kategorije)
// ============================================================
export const RAILING_STYLES: RailingStyleInfo[] = [
  {
    id: 'WPC_H_LINE',
    name: 'ROKSAL WPC H-Line',
    description: 'Vodoravne WPC letve na ALU stebru. Najbolj priljubljen sistem za balkone.',
    pricePerM2: 190,
    material: 'WPC + ALU',
    wpcCompatible: true,
  },
  {
    id: 'WPC_V_LINE',
    name: 'ROKSAL WPC V-Line',
    description: 'Pokončne WPC letve na ALU stebru. Varnosten in eleganten sistem.',
    pricePerM2: 210,
    material: 'WPC + ALU',
    wpcCompatible: true,
  },
  {
    id: 'WPC_PANEL',
    name: 'ROKSAL WPC Panelna',
    description: 'WPC paneli z CNC laserskim izrezom. Unikatno oblikovanje polnila.',
    pricePerM2: 225,
    material: 'WPC Panel',
    wpcCompatible: true,
  },
  {
    id: 'WPC_STEKLO',
    name: 'ROKSAL WPC + Steklo',
    description: 'Kombinacija WPC letvic z varnostnim steklom. Premium izvedba.',
    pricePerM2: 320,
    material: 'WPC + Steklo',
    wpcCompatible: true,
  },
  {
    id: 'WPC_KLASIC',
    name: 'ROKSAL WPC Klasik',
    description: 'Tradicionalna oblika s WPC letvami. Zanesljiva in časovno preizkušena.',
    pricePerM2: 195,
    material: 'WPC + ALU',
    wpcCompatible: true,
  },
  {
    id: 'WPC_COMBO',
    name: 'ROKSAL WPC Combo',
    description: 'Kombinacija horizontalnih in vertikalnih WPC letvic. Moderen dizajn.',
    pricePerM2: 235,
    material: 'WPC + ALU',
    wpcCompatible: true,
  },
];

// ============================================================
// MONTAŽNE SPECIFIKACIJE
// ============================================================
export const INSTALLATION_SPECS = {
  maxPostSpacing: 150, // cm - max razmik stebričkov
  supportSpacing: 100, // cm - max razmik nosilcev
  minHeight: 90, // cm - minimalna višina ograje
  maxHeight: 120, // cm - maksimalna višina brez ojačitve
  standardHeight: 110, // cm - standardna višina
  wpcBoardThickness: 23, // mm - debelina WPC letve
  wpcBoardWidthNarrow: 140, // mm - ozka WPC letve
  wpcBoardWidthWide: 180, // mm - široke WPC letve
  maxBoardLength: 400, // cm - max dolžina plošče
  railingGap: 110, // mm - razmik med letvami
  aluPostSize: '40×40mm', // standardni ALU steber
  aluPostSizeLarge: '50×50mm', // večji ALU steber za steklo
  screwType: 'A2 Inox vijaki', // tip vijakov
  anchorType: 'Kemični sidri', // tip sidranja v beton
  warrantyYears: 15, // leta garancije
  lifespanYears: 35, // leta življenjske dobe
} as const;

// ============================================================
// KALKULACIJA CENE (m² osnova za WPC)
// ============================================================
export function calculatePrice(project: PriceInput): PriceBreakdown {
  const style = RAILING_STYLES.find((s) => s.id === project.railingStyle);
  const pricePerM2 = style?.pricePerM2 ?? 190;

  // Skupna dolžina v m (dolžina + 2×širina) z 10% rezervo
  const totalMeters = ((project.lengthCm + 2 * project.widthCm) / 100) * 1.1;

  // Površina v m² (dolžina × višina)
  const totalArea = (project.lengthCm / 100) * (project.heightCm / 100);

  // Višinski množitelj (nad 100cm se cena povečuje)
  const heightMultiplier =
    project.heightCm > 100 ? 1.0 + (project.heightCm - 100) * 0.012 : 1.0;

  // Materialni stroški na osnovi m²
  const baseMaterialCost = totalArea * pricePerM2 * heightMultiplier;

  // Montažni stroški glede na tip
  const mountingLabor =
    project.mountType === 'Bočno (V fasado)'
      ? 140
      : project.mountType === 'Na stopnice'
      ? 160
      : project.mountType === 'Vogalni steber'
      ? 120
      : 50;

  const subtotal = baseMaterialCost + mountingLabor;
  const discountAmount = subtotal * (project.discount / 100);
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * (project.vatRate / 100);
  const totalWithVat = afterDiscount + vatAmount;

  return {
    totalArea,
    totalMeters,
    heightMultiplier,
    baseMaterialCost,
    mountingLabor,
    subtotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    totalWithVat,
  };
}
