// ============================================================
// ROKSAL - RAL barvni paleti za balkonske ograje (26 barv)
// ============================================================

// RAL barva (za kovinske dele - stebrički, nosilci)
export interface RALColor {
  code: string;
  name: string;
  hexColor: string;
  category: string;
}

export const RAL_BALCONY_COLORS: RALColor[] = [
  { code: '7016', name: 'Antracit siva', hexColor: '#383E42', category: 'Sive' },
  { code: '9005', name: 'Črna mat', hexColor: '#121212', category: 'Črne' },
  { code: '9010', name: 'Bela čista', hexColor: '#FFFFFF', category: 'Bele' },
  { code: '9016', name: 'Bela prometna', hexColor: '#F6F6F6', category: 'Bele' },
  { code: '7035', name: 'Svetlo siva', hexColor: '#CBD0CC', category: 'Sive' },
  { code: '7030', name: 'Kamnito siva', hexColor: '#9E9E9E', category: 'Sive' },
  { code: '9003', name: 'Signalna bela', hexColor: '#EDEDED', category: 'Bele' },
  { code: '7024', name: 'Grafitna siva', hexColor: '#474A50', category: 'Sive' },
  { code: '7021', name: 'Temno siva', hexColor: '#363838', category: 'Sive' },
  { code: '8017', name: 'Čokoladno rjava', hexColor: '#402A24', category: 'Rjave' },
  { code: '8019', name: 'Sivi rjava', hexColor: '#3F3A36', category: 'Rjave' },
  { code: '8003', name: 'Glinasto rjava', hexColor: '#5E4B46', category: 'Rjave' },
  { code: '3009', name: 'Oksidno rdeča', hexColor: '#703731', category: 'Rdeče' },
  { code: '3011', name: 'Rjavo rdeča', hexColor: '#6E1E1E', category: 'Rdeče' },
  { code: '6005', name: 'Mahovo zelena', hexColor: '#114232', category: 'Zelene' },
  { code: '6020', name: 'Kromovo zelena', hexColor: '#2F5C56', category: 'Zelene' },
  { code: '5010', name: 'Encijanovo modra', hexColor: '#26447B', category: 'Modre' },
  { code: '5002', name: 'Ultramarinsko modra', hexColor: '#202860', category: 'Modre' },
  { code: '4004', name: 'Borovo vijolična', hexColor: '#4A2850', category: 'Vijolične' },
  { code: 'EV1', name: 'Srebrna eloksirana', hexColor: '#B0B4B5', category: 'Eloksirane' },
  { code: 'EV2', name: 'Svetlo bronasta eloks.', hexColor: '#8B7D6B', category: 'Eloksirane' },
  { code: 'EV6', name: 'Temno bronasta eloks.', hexColor: '#5C513F', category: 'Eloksirane' },
  { code: 'IM-HR', name: 'Imitacija Hrast', hexColor: '#8B5A2B', category: 'Imitacije lesa' },
  { code: 'IM-OR', name: 'Imitacija Oreh', hexColor: '#5C4033', category: 'Imitacije lesa' },
  { code: 'IM-MA', name: 'Imitacija Mahagonij', hexColor: '#6B2D3A', category: 'Imitacije lesa' },
  { code: 'IM-TI', name: 'Imitacija Tik', hexColor: '#4A3B2A', category: 'Imitacije lesa' },
];

export const RAL_CATEGORIES = [
  'Vse',
  'Sive',
  'Bele',
  'Črne',
  'Rjave',
  'Rdeče',
  'Zelene',
  'Modre',
  'Vijolične',
  'Eloksirane',
  'Imitacije lesa',
] as const;

export type RALCategory = (typeof RAL_CATEGORIES)[number];

// Pomožna funkcija - iskanje barve po kodi
export function findRALColor(code: string): RALColor | undefined {
  return RAL_BALCONY_COLORS.find((c) => c.code === code);
}
