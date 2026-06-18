import { describe, it, expect, beforeEach } from 'vitest';
import {
  addBrandAsset,
  getBrandAssets,
  deleteBrandAsset,
  getBrandProfile,
  hexToRgb,
  getContrastColor,
  generateColorPalette,
  getFontPairings,
  getAssetsByClient,
  COMMON_FONTS,
} from './brand-asset-library';

describe('addBrandAsset and getBrandAssets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and retrieves an asset', () => {
    addBrandAsset({
      projectId: 'proj-1',
      clientName: 'Acme',
      type: 'color',
      name: 'Primary Blue',
      value: '#6366f1',
      tags: ['brand'],
    });
    const assets = getBrandAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('Primary Blue');
    expect(assets[0].value).toBe('#6366f1');
  });

  it('filters by projectId', () => {
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'color', name: 'Blue', value: '#0000ff', tags: [] });
    addBrandAsset({ projectId: 'proj-2', clientName: 'Beta', type: 'color', name: 'Red', value: '#ff0000', tags: [] });
    const proj1Assets = getBrandAssets('proj-1');
    expect(proj1Assets).toHaveLength(1);
    expect(proj1Assets[0].clientName).toBe('Acme');
  });

  it('deleteBrandAsset removes asset', () => {
    const asset = addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'color', name: 'Blue', value: '#0000ff', tags: [] });
    deleteBrandAsset(asset.id);
    expect(getBrandAssets()).toHaveLength(0);
  });
});

describe('getBrandProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('groups assets by type', () => {
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'logo', name: 'Logo', value: 'url', tags: [] });
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'color', name: 'Blue', value: '#00f', tags: [] });
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'font', name: 'Inter', value: 'Inter', tags: [] });
    const profile = getBrandProfile('proj-1', 'Acme');
    expect(profile.logo).toBeDefined();
    expect(profile.colors).toHaveLength(1);
    expect(profile.fonts).toHaveLength(1);
  });

  it('returns empty profile for unknown project', () => {
    const profile = getBrandProfile('unknown', 'Unknown');
    expect(profile.logo).toBeUndefined();
    expect(profile.colors).toHaveLength(0);
  });
});

describe('color utilities', () => {
  it('hexToRgb parses hex correctly', () => {
    const rgb = hexToRgb('#6366f1');
    expect(rgb).toEqual({ r: 99, g: 102, b: 241 });
  });

  it('hexToRgb returns null for invalid hex', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
  });

  it('getContrastColor returns black for light colors', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
  });

  it('getContrastColor returns white for dark colors', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
  });

  it('generateColorPalette creates palette from primary', () => {
    const palette = generateColorPalette('#6366f1');
    expect(palette.primary).toBe('#6366f1');
    expect(palette.secondary).toBeDefined();
    expect(palette.accent).toBeDefined();
    expect(palette.background).toBe('#ffffff');
  });
});

describe('font utilities', () => {
  it('COMMON_FONTS has entries', () => {
    expect(COMMON_FONTS.length).toBeGreaterThan(0);
  });

  it('getFontPairings returns fonts', () => {
    const pairings = getFontPairings('Playfair Display');
    expect(pairings.length).toBeGreaterThan(0);
  });

  it('getFontPairings returns defaults for unknown font', () => {
    const pairings = getFontPairings('Unknown Font');
    expect(pairings.length).toBeGreaterThan(0);
  });
});

describe('getAssetsByClient', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('groups assets by client name', () => {
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'color', name: 'Blue', value: '#00f', tags: [] });
    addBrandAsset({ projectId: 'proj-2', clientName: 'Beta', type: 'color', name: 'Red', value: '#f00', tags: [] });
    addBrandAsset({ projectId: 'proj-1', clientName: 'Acme', type: 'font', name: 'Inter', value: 'Inter', tags: [] });
    const byClient = getAssetsByClient();
    expect(byClient['Acme']).toHaveLength(2);
    expect(byClient['Beta']).toHaveLength(1);
  });
});
