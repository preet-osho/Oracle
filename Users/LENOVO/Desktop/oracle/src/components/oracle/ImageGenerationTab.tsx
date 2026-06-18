'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import { NeverStopRouter } from '@/lib/router';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { nanoid } from 'nanoid';

// ─── Types ─────────────────────────────

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  style: string;
  size: string;
  createdAt: number;
}

type ImageStyle = 'vivid' | 'natural';
type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

const STYLES: { id: ImageStyle; label: string; emoji: string; description: string }[] = [
  { id: 'vivid', label: 'Vivid', emoji: '🎨', description: 'Hyper-real, dramatic, artistic' },
  { id: 'natural', label: 'Natural', emoji: '📷', description: 'Realistic, photographic' },
];

const SIZES: { id: ImageSize; label: string; emoji: string; description: string }[] = [
  { id: '1024x1024', label: 'Square', emoji: '⬜', description: '1024×1024 — Social posts' },
  { id: '1792x1024', label: 'Landscape', emoji: '🖼️', description: '1792×1024 — Banners, presentations' },
  { id: '1024x1792', label: 'Portrait', emoji: '📱', description: '1024×1792 — Stories, mobile' },
];

const PRESET_PROMPTS = [
  { emoji: '🏪', label: 'Restaurant interior', prompt: 'Modern Indian restaurant interior, warm lighting, wooden furniture, decorative elements, evening ambiance' },
  { emoji: '🛒', label: 'Product showcase', prompt: 'Professional product photography, clean white background, soft shadows, premium D2C brand aesthetic' },
  { emoji: '📱', label: 'Social media post', prompt: 'Eye-catching social media graphic, vibrant colors, modern typography, Instagram-ready layout' },
  { emoji: '🏢', label: 'Office/team', prompt: 'Modern Indian startup office, diverse team collaborating, glass walls, plants, natural light' },
  { emoji: '🎯', label: 'Ad creative', prompt: 'Bold advertising creative, product in use, lifestyle shot, Indian market context, professional photography' },
  { emoji: '🎓', label: 'Education graphic', prompt: 'Educational infographic style, clean design, icons, charts, modern EdTech aesthetic' },
];

// ─── Image Generation Tab ──────────────

export function ImageGenerationTab() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('vivid');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [isGenerating, setIsGenerating] = useState(false);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const generateImage = useCallback(async (overridePrompt?: string) => {
    const effectivePrompt = overridePrompt || prompt.trim();
    if (!effectivePrompt) return;

    setIsGenerating(true);
    try {
      // Get OpenAI key from BYOK storage
      const apiKey = NeverStopRouter.getKey('openai');
      if (!apiKey) {
        toast.error('❌ OpenAI API key required. Add it in Settings → API Keys.', TOAST_DEFAULTS);
        setIsGenerating(false);
        return;
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: effectivePrompt,
          n: 1,
          size,
          style,
          quality: 'hd',
          response_format: 'url',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      const newImage: GeneratedImage = {
        id: nanoid(),
        url: imageUrl,
        prompt: effectivePrompt,
        style,
        size,
        createdAt: Date.now(),
      };

      setGallery((prev) => [newImage, ...prev]);
      toast.success('✅ Image generated', TOAST_DEFAULTS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate image';
      toast.error(`❌ ${message}`, TOAST_DEFAULTS);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, style, size]);

  const downloadImage = useCallback(async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oracle-image-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('✅ Image downloaded', TOAST_DEFAULTS);
    } catch {
      toast.error('❌ Failed to download image', TOAST_DEFAULTS);
    }
  }, []);

  const deleteImage = useCallback((id: string) => {
    setGallery((prev) => prev.filter((img) => img.id !== id));
    if (selectedImage?.id === id) setSelectedImage(null);
  }, [selectedImage]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">🎨 Image Generation</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Create AI-powered images for ad creatives, social media, and brand assets using DALL-E 3</p>
          </motion.div>

          {/* Prompt Input */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth}>
            <div className="oracle-glass rounded-2xl p-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create...

Examples:
• 'Modern Indian restaurant interior, warm lighting, wooden furniture, evening ambiance'
• 'Professional product photography, clean white background, premium D2C skincare brand'
• 'Bold social media ad creative, Diwali sale, vibrant colors, 50% off text overlay'"
                rows={4}
                className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-4 py-3 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)] transition-colors"
              />

              {/* Style & Size Selectors */}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)] uppercase tracking-wider">Style</label>
                  <div className="flex gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className={`flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
                          style === s.id
                            ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                            : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:border-[var(--oracle-border-strong)] hover:bg-[var(--oracle-card-hover)]'
                        }`}
                      >
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-[var(--oracle-text-muted)] uppercase tracking-wider">Size</label>
                  <div className="flex gap-2">
                    {SIZES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSize(s.id)}
                        className={`flex-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-all ${
                          size === s.id
                            ? 'border-[var(--oracle-primary)] bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]'
                            : 'border-[var(--oracle-border)] text-[var(--oracle-text-3)] hover:border-[var(--oracle-border-strong)] hover:bg-[var(--oracle-card-hover)]'
                        }`}
                      >
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-[var(--oracle-text-muted)]">
                  {prompt.trim() ? `~${Math.ceil(prompt.trim().length / 4)} tokens` : 'Enter a prompt to generate'}
                </span>
                <motion.button
                  {...buttonTapProps}
                  onClick={() => generateImage()}
                  disabled={!prompt.trim() || isGenerating}
                  className="flex items-center justify-center gap-2 rounded-xl oracle-gradient-bg px-6 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    '🎨 Generate Image'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Preset Prompts */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-[var(--oracle-text-muted)] uppercase tracking-wider">Quick Prompts</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESET_PROMPTS.map((preset) => (
                <motion.button
                  key={preset.label}
                  {...buttonTapProps}
                  onClick={() => { setPrompt(preset.prompt); generateImage(preset.prompt); }}
                  disabled={isGenerating}
                  className="oracle-glass oracle-glass-hover flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all disabled:opacity-40"
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="text-[12px] font-medium text-[var(--oracle-text-2)]">{preset.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Gallery */}
          {gallery.length > 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">🖼️ Gallery ({gallery.length})</p>
                <button onClick={() => setGallery([])} className="text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] transition-colors">
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((image) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative overflow-hidden rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)]"
                  >
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-full p-2">
                        <p className="mb-1 line-clamp-2 text-[10px] text-white/90">{image.prompt}</p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedImage(image)}
                            className="rounded-md bg-white/20 px-2 py-1 text-[10px] text-white hover:bg-white/30 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => downloadImage(image)}
                            className="rounded-md bg-white/20 px-2 py-1 text-[10px] text-white hover:bg-white/30 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => deleteImage(image.id)}
                            className="ml-auto rounded-md bg-red-500/30 px-2 py-1 text-[10px] text-red-200 hover:bg-red-500/50 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Style/size badge */}
                    <div className="absolute top-2 right-2">
                      <span className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
                        {image.style} · {image.size.split('x')[0]}px
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {gallery.length === 0 && (
            <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mt-8 text-center">
              <div className="mb-4 text-4xl">🎨</div>
              <p className="text-[15px] font-semibold text-[var(--oracle-text-2)]">No images generated yet</p>
              <p className="mt-1 text-[12px] text-[var(--oracle-text-muted)]">Enter a prompt above or click a quick prompt to start</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Full-size Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl border border-[var(--oracle-border)] bg-[var(--oracle-bg)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selectedImage.url} alt={selectedImage.prompt} className="max-h-[70vh] w-full object-contain" />
            <div className="p-4">
              <p className="mb-2 text-[13px] text-[var(--oracle-text-2)]">{selectedImage.prompt}</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--oracle-surface-2)] px-2 py-0.5 text-[10px] text-[var(--oracle-text-muted)]">
                  {selectedImage.style} · {selectedImage.size}
                </span>
                <span className="text-[10px] text-[var(--oracle-text-muted)]">
                  {new Date(selectedImage.createdAt).toLocaleString()}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedImage.url); toast.success('URL copied', TOAST_DEFAULTS); }}
                    className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                  >
                    📋 Copy URL
                  </button>
                  <button
                    onClick={() => downloadImage(selectedImage)}
                    className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    ⬇️ Download
                  </button>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="rounded-lg border border-[var(--oracle-border)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)] transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
