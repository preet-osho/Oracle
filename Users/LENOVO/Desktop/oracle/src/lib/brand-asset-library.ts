// ═══════════════════════════════════════
// ORACLE — Brand Asset Library
// Store client logos, colors, fonts · Brand management per client
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type AssetType = 'logo' | 'color' | 'font' | 'image' | 'document' | 'other';

export interface BrandAsset {
  id: string;
  projectId: string;
  clientName: string;
  type: AssetType;
  name: string;
  value: string; // Hex color, font name, URL, or data URL
  metadata?: Record<string, string>;
  tags: string[];
  createdAt: number;
}

export interface BrandProfile {
  clientName: string;
  projectId: string;
  logo?: BrandAsset;
  colors: BrandAsset[];
  fonts: BrandAsset[];
  images: BrandAsset[];
  lastUpdated: number;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
}

// ─── Storage ───────────────────────────

const ASSETS_KEY = 'oracle_brand_assets';

export function addBrandAsset(
  asset: Omit<BrandAsset, 'id' | 'createdAt'>
): BrandAsset {
  const full: BrandAsset = {
    ...asset,
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };

  if (typeof window === 'undefined') return full;
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    const assets: BrandAsset[] = raw ? JSON.parse(raw) : [];
    assets.unshift(full);
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets.slice(0, 2000)));
  } catch {
    // Silently fail
  }
  return full;
}

export function getBrandAssets(projectId?: string): BrandAsset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    const assets: BrandAsset[] = raw ? JSON.parse(raw) : [];
    if (projectId) return assets.filter((a) => a.projectId === projectId);
    return assets;
  } catch {
    return [];
  }
}

export function deleteBrandAsset(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    const assets: BrandAsset[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets.filter((a) => a.id !== id)));
  } catch {
    // Silently fail
  }
}

export function getBrandProfile(projectId: string, clientName: string): BrandProfile {
  const assets = getBrandAssets(projectId);
  return {
    clientName,
    projectId,
    logo: assets.find((a) => a.type === 'logo'),
    colors: assets.filter((a) => a.type === 'color'),
    fonts: assets.filter((a) => a.type === 'font'),
    images: assets.filter((a) => a.type === 'image'),
    lastUpdated: assets.length > 0 ? Math.max(...assets.map((a) => a.createdAt)) : 0,
  };
}

// ─── Color Utilities ───────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

export function generateColorPalette(primaryHex: string): ColorPalette {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) {
    return {
      primary: primaryHex,
      secondary: '#6366f1',
      accent: '#10b981',
      background: '#ffffff',
      text: '#0f1020',
      muted: '#7080b0',
    };
  }

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return {
    primary: primaryHex,
    secondary: `hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%)`,
    accent: `hsl(${(hsl.h + 180) % 360}, ${Math.min(hsl.s + 10, 100)}%, ${hsl.l}%)`,
    background: '#ffffff',
    text: '#0f1020',
    muted: '#7080b0',
  };
}

// ─── Font Utilities ────────────────────

export const COMMON_FONTS = [
  { name: 'Inter', category: 'sans-serif', style: 'Modern, clean' },
  { name: 'Poppins', category: 'sans-serif', style: 'Geometric, friendly' },
  { name: 'Playfair Display', category: 'serif', style: 'Elegant, classic' },
  { name: 'Montserrat', category: 'sans-serif', style: 'Versatile, professional' },
  { name: 'Roboto', category: 'sans-serif', style: 'Neutral, readable' },
  { name: 'Open Sans', category: 'sans-serif', style: 'Friendly, legible' },
  { name: 'Lora', category: 'serif', style: 'Calligraphic, elegant' },
  { name: 'Raleway', category: 'sans-serif', style: 'Elegant, thin' },
  { name: 'Nunito', category: 'sans-serif', style: 'Rounded, friendly' },
  { name: 'Merriweather', category: 'serif', style: 'Strong, readable' },
  { name: 'PT Sans', category: 'sans-serif', style: 'Humanist, warm' },
  { name: 'Oswald', category: 'sans-serif', style: 'Condensed, bold' },
];

export function getFontPairings(heading: string): string[] {
  const pairings: Record<string, string[]> = {
    'Playfair Display': ['Source Sans Pro', 'Lato', 'Open Sans'],
    'Montserrat': ['Merriweather', 'Lora', 'PT Serif'],
    'Poppins': ['Lora', 'Merriweather', 'Source Serif Pro'],
    'Inter': ['Lora', 'Merriweather', 'Georgia'],
    'Oswald': ['Open Sans', 'Lato', 'Roboto'],
    'Raleway': ['Lora', 'Merriweather', 'Roboto Slab'],
    'Nunito': ['Lora', 'Playfair Display', 'Merriweather'],
  };

  return pairings[heading] || ['Open Sans', 'Roboto', 'Lato'];
}

// ─── Asset Type Helpers ────────────────

export function getAssetTypeIcon(type: AssetType): string {
  switch (type) {
    case 'logo': return '🎨';
    case 'color': return '🎨';
    case 'font': return '🔤';
    case 'image': return '🖼';
    case 'document': return '📄';
    default: return '📎';
  }
}

export function getAssetTypeLabel(type: AssetType): string {
  switch (type) {
    case 'logo': return 'Logo';
    case 'color': return 'Color';
    case 'font': return 'Font';
    case 'image': return 'Image';
    case 'document': return 'Document';
    default: return 'Other';
  }
}

export function getAssetsByClient(): Record<string, BrandAsset[]> {
  const assets = getBrandAssets();
  const byClient: Record<string, BrandAsset[]> = {};
  for (const asset of assets) {
    if (!byClient[asset.clientName]) byClient[asset.clientName] = [];
    byClient[asset.clientName].push(asset);
  }
  return byClient;
}
