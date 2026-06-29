'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import {
  addBrandAsset,
  getBrandAssets,
  deleteBrandAsset,
  getAssetsByClient,
  hexToRgb,
  getContrastColor,
  getAssetTypeIcon,
  getAssetTypeLabel,
  COMMON_FONTS,
  getFontPairings,
} from '@/lib/brand-asset-library';
import type { BrandAsset, AssetType } from '@/lib/brand-asset-library';

// ─── BrandAssetsPanel ─────────────────

export function BrandAssetsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey intentionally triggers recomputation after localStorage mutations
  const allAssets = useMemo(() => getBrandAssets(), [refreshKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byClient = useMemo(() => getAssetsByClient(), [refreshKey]);
  const clientNames = Object.keys(byClient);

  const filteredAssets = useMemo(() => {
    if (selectedClient) return allAssets.filter((a) => a.clientName === selectedClient);
    return allAssets;
  }, [allAssets, selectedClient]);

  const handleAdd = useCallback((data: Omit<BrandAsset, 'id' | 'createdAt'>) => {
    addBrandAsset(data);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteBrandAsset(id);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎨 Brand Assets</h1>
                <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">
                  Manage client logos, colors, fonts, and brand guidelines
                </p>
              </div>
              <motion.button
                {...buttonTapProps}
                onClick={() => setShowForm(!showForm)}
                className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-4 py-2.5 text-[13px] font-semibold text-white transition-all"
              >
                {showForm ? '✕ Close' : '+ Add Asset'}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon="🎨" label="Logos" value={String(allAssets.filter((a) => a.type === 'logo').length)} />
              <StatCard icon="🎨" label="Colors" value={String(allAssets.filter((a) => a.type === 'color').length)} />
              <StatCard icon="🔤" label="Fonts" value={String(allAssets.filter((a) => a.type === 'font').length)} />
              <StatCard icon="📁" label="Clients" value={String(clientNames.length)} />
            </div>
          </motion.div>

          {/* Client Filter */}
          {clientNames.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedClient(null)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${!selectedClient ? 'oracle-gradient-bg text-white' : 'border border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}
                >
                  All ({allAssets.length})
                </button>
                {clientNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedClient(name === selectedClient ? null : name)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${selectedClient === name ? 'oracle-gradient-bg text-white' : 'border border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]'}`}
                  >
                    {name} ({byClient[name].length})
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Add Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={transitions.smooth}>
                <AddAssetForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Font Pairings Reference */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <h3 className="mb-3 text-[15px] font-bold text-[var(--oracle-text-1)]">🔤 Font Pairing Reference</h3>
              <div className="space-y-2">
                {COMMON_FONTS.slice(0, 6).map((font) => (
                  <div key={font.name} className="flex items-center gap-3 rounded-lg bg-[var(--oracle-surface-2)] p-2">
                    <span className="w-32 text-[12px] font-semibold text-[var(--oracle-text-1)]">{font.name}</span>
                    <span className="text-[10px] text-[var(--oracle-text-muted)]">{font.category} · {font.style}</span>
                    <span className="ml-auto text-[10px] text-[var(--oracle-info)]">
                      Pairs: {getFontPairings(font.name).slice(0, 2).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Assets Grid */}
          {filteredAssets.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
              <div className="oracle-glass rounded-2xl p-5">
                <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📋 Assets ({filteredAssets.length})</h3>
                <div className="space-y-2">
                  {filteredAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-[var(--oracle-border)] p-3">
                      {/* Color swatch or icon */}
                      {asset.type === 'color' ? (
                        <div
                          className="h-10 w-10 shrink-0 rounded-lg border border-[var(--oracle-border)]"
                          style={{ backgroundColor: asset.value }}
                          title={asset.value}
                        />
                      ) : asset.type === 'font' ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--oracle-surface-2)]">
                          <span className="text-lg">{getAssetTypeIcon(asset.type)}</span>
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--oracle-surface-2)]">
                          <span className="text-lg">{getAssetTypeIcon(asset.type)}</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{asset.name}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]">
                            {getAssetTypeLabel(asset.type)}
                          </span>
                          <span className="text-[10px] text-[var(--oracle-text-muted)]">{asset.clientName}</span>
                        </div>
                        {asset.type === 'color' && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[var(--oracle-text-3)]">{asset.value}</span>
                            {hexToRgb(asset.value) && (
                              <span className="text-[10px] text-[var(--oracle-text-muted)]">
                                RGB({hexToRgb(asset.value)!.r}, {hexToRgb(asset.value)!.g}, {hexToRgb(asset.value)!.b})
                              </span>
                            )}
                            <div
                              className="h-4 w-4 rounded border border-[var(--oracle-border)]"
                              style={{ backgroundColor: getContrastColor(asset.value), color: asset.value }}
                            >
                              <span className="flex items-center justify-center text-[8px] font-bold">A</span>
                            </div>
                          </div>
                        )}
                        {asset.type === 'font' && (
                          <span className="text-[11px] text-[var(--oracle-text-3)]">{asset.value}</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="shrink-0 rounded-lg p-1.5 text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] hover:text-[var(--oracle-error)] transition-colors"
                        aria-label={`Delete ${asset.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {allAssets.length === 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="py-8 text-center">
              <div className="mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--oracle-surface-2)]">
                <span className="text-4xl">🎨</span>
              </div>
              <h3 className="mb-2 text-[18px] font-bold text-[var(--oracle-text-1)]">No Brand Assets Yet</h3>
              <p className="max-w-md mx-auto text-[14px] text-[var(--oracle-text-3)]">
                Click &quot;Add Asset&quot; to store client logos, colors, fonts, and other brand guidelines.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Asset Form ───────────────────

function AddAssetForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Omit<BrandAsset, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const [clientName, setClientName] = useState('');
  const [type, setType] = useState<AssetType>('color');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = () => {
    if (!clientName.trim() || !name.trim() || !value.trim()) return;
    onSubmit({
      projectId: 'manual',
      clientName: clientName.trim(),
      type,
      name: name.trim(),
      value: value.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="oracle-glass rounded-2xl p-5">
      <h3 className="mb-4 text-[15px] font-bold text-[var(--oracle-text-1)]">📝 Add Brand Asset</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <select value={type} onChange={(e) => setType(e.target.value as AssetType)} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-2)] outline-none">
            <option value="color">🎨 Color</option>
            <option value="font">🔤 Font</option>
            <option value="logo">🖼 Logo</option>
            <option value="image">🖼 Image</option>
            <option value="document">📄 Document</option>
          </select>
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asset name (e.g. Primary Blue, Heading Font)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />

        {type === 'color' ? (
          <div className="flex items-center gap-3">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="#6366f1" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 font-mono text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
            <input type="color" value={value || '#6366f1'} onChange={(e) => setValue(e.target.value)} className="h-10 w-10 shrink-0 rounded-lg border border-[var(--oracle-border)] cursor-pointer" />
          </div>
        ) : type === 'font' ? (
          <select value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
            <option value="">Select a font...</option>
            {COMMON_FONTS.map((f) => (
              <option key={f.name} value={f.name}>{f.name} ({f.style})</option>
            ))}
          </select>
        ) : (
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="URL or data URL" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
        )}

        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />

        <div className="flex items-center justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onCancel} className="rounded-xl border border-[var(--oracle-border)] px-4 py-2 text-[12px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors">
            Cancel
          </motion.button>
          <motion.button {...buttonTapProps} onClick={handleSubmit} disabled={!clientName.trim() || !name.trim() || !value.trim()} className="rounded-xl oracle-gradient-bg px-6 py-2 text-[12px] font-semibold text-white transition-all disabled:opacity-40">
            Save Asset
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="oracle-glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] text-[var(--oracle-text-muted)]">{label}</span>
      </div>
      <p className="text-[20px] font-bold text-[var(--oracle-text-1)]">{value}</p>
    </div>
  );
}
