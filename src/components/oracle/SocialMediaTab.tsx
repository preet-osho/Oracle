'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  getPlatformStatus,
  listPosts,
  getPostStats,
  getQueue,
  quickPost,
  schedulePost,
  deletePost,
  updatePost,
} from '@/lib/social-media/hub';
import type { SocialMediaPost, SocialPlatform, PostStatus, PostType, PostQueueItem } from '@/lib/social-media/types';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { postsToCSV, postsToICS, downloadFile, icsToDataURI, googleCalendarImportURL, outlookImportURL, openCalendarImport } from '@/lib/social-media/calendar-export';

// ─── Types ─────────────────────────────

type CalendarTab = 'calendar' | 'posts' | 'analytics' | 'queue';

// ─── Helpers ───────────────────────────

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  linkedin: '💼',
  instagram: '📸',
  facebook: '📘',
  whatsapp: '💬',
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  linkedin: 'bg-sky-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  whatsapp: 'bg-emerald-500',
};

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
  scheduled: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  publishing: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const POST_TYPE_ICONS: Record<PostType, string> = {
  text: '📝',
  image: '🖼️',
  video: '🎥',
  link: '🔗',
  carousel: '🎠',
};

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Metric Card ───────────────────────

function MetricCard({ title, value, subtitle, icon, color = 'text-zinc-100' }: {
  title: string; value: string | number; subtitle?: string; icon: string; color?: string;
}) {
  return (
    <Card className="border-white/10 bg-white/5 hover:bg-white/8 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
          </div>
          <span className="text-lg">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Platform Status Card ──────────────

function PlatformStatusCard({ platforms }: { platforms: Record<SocialPlatform, { configured: boolean; name: string }> }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📡 Platform Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(platforms).map(([key, info]) => {
            const platform = key as SocialPlatform;
            return (
              <div key={platform} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span>{PLATFORM_ICONS[platform]}</span>
                  <span className="text-xs text-zinc-300">{info.name}</span>
                </div>
                <Badge className={`text-[10px] ${info.configured
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                }`}>
                  {info.configured ? 'Connected' : 'Not configured'}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Post Card ─────────────────────────

function PostCard({ post, onDelete }: { post: SocialMediaPost; onDelete?: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg bg-zinc-800/30 border border-white/5 hover:bg-zinc-800/50 transition-colors">
      <span className="text-sm mt-0.5">{PLATFORM_ICONS[post.platform]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-[9px] ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
          <Badge className="text-[9px] bg-white/10 text-zinc-300 border-white/10">
            {POST_TYPE_ICONS[post.postType]} {post.postType}
          </Badge>
          {post.scheduledAt && (
            <span className="text-[10px] text-zinc-500">
              📅 {formatDate(post.scheduledAt)} at {formatTime(post.scheduledAt)}
            </span>
          )}
          {post.publishedAt && (
            <span className="text-[10px] text-emerald-500">
              ✅ Published {formatTimeAgo(post.publishedAt)}
            </span>
          )}
        </div>
        <p className="text-[12px] text-zinc-300 mt-1 line-clamp-2">{post.text}</p>
        {post.hashtags.length > 0 && (
          <p className="text-[10px] text-sky-400 mt-1">{post.hashtags.join(' ')}</p>
        )}
        {post.error && (
          <p className="text-[10px] text-red-400 mt-1">❌ {post.error}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[9px] text-zinc-600">{formatTimeAgo(post.createdAt)}</span>
        {post.status === 'draft' && onDelete && (
          <button onClick={() => onDelete(post.id)} className="text-[10px] text-red-400 hover:text-red-300">🗑</button>
        )}
      </div>
    </div>
  );
}

// ─── Post Composer ─────────────────────

function PostComposer({ onPost, onSchedule }: {
  onPost: (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[] }) => void;
  onSchedule: (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[]; scheduledAt: number }) => void;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [text, setText] = useState('');
  const [postType, setPostType] = useState<PostType>('text');
  const [hashtags, setHashtags] = useState('');
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  const handleSubmit = () => {
    if (!text.trim()) return;
    const tags = hashtags.split(/[\s,]+/).filter((t) => t.startsWith('#')).map((t) => t.trim());

    if (scheduleMode && scheduleDate) {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).getTime();
      onSchedule({ platform, text, postType, hashtags: tags, scheduledAt });
    } else {
      onPost({ platform, text, postType, hashtags: tags });
    }

    setText('');
    setHashtags('');
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          ✍️ Create Post
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Platform Selector */}
        <div className="flex gap-1.5">
          {(['linkedin', 'instagram', 'facebook', 'whatsapp'] as SocialPlatform[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors flex items-center gap-1 ${
                platform === p
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {PLATFORM_ICONS[p]} {p}
            </button>
          ))}
        </div>

        {/* Post Type */}
        <div className="flex gap-1.5">
          {(['text', 'image', 'link', 'carousel'] as PostType[]).map((t) => (
            <button
              key={t}
              onClick={() => setPostType(t)}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                postType === t
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {POST_TYPE_ICONS[t]} {t}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your post content..."
          className="w-full px-3 py-2 text-[12px] bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none h-24"
        />

        {/* Hashtags */}
        <input
          type="text"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#hashtag1 #hashtag2"
          className="w-full px-3 py-1.5 text-[11px] bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />

        {/* Schedule Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors ${
              scheduleMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-white/10'
            }`}
          >
            📅 {scheduleMode ? 'Scheduling' : 'Schedule'}
          </button>
          {scheduleMode && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="h-7 text-[11px] bg-zinc-800/50 border border-white/10 rounded px-2 text-zinc-300 focus:outline-none"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-7 text-[11px] bg-zinc-800/50 border border-white/10 rounded px-2 text-zinc-300 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="w-full text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
        >
          {scheduleMode ? '📅 Schedule Post' : '📤 Post Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Calendar Post Creator Modal ─────

function CalendarPostCreator({ date, onClose, onSchedule }: {
  date: Date;
  onClose: () => void;
  onSchedule: (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[]; scheduledAt: number }) => void;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>('linkedin');
  const [text, setText] = useState('');
  const [postType, setPostType] = useState<PostType>('text');
  const [hashtags, setHashtags] = useState('');
  const [time, setTime] = useState('09:00');

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSchedule = () => {
    if (!text.trim()) return;
    const tags = hashtags.split(/[\s,]+/).filter((t) => t.startsWith('#')).map((t) => t.trim());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const scheduledAt = new Date(`${year}-${month}-${day}T${time}:00`).getTime();
    onSchedule({ platform, text, postType, hashtags: tags, scheduledAt });
    toast.success('📅 Post scheduled', TOAST_DEFAULTS);
  };

  const dateLabel = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        variants={motionVariants.scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transitions.popSpring}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">📅 Schedule Post</h3>
            <p className="text-[11px] text-zinc-500">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
        </div>

        {/* Platform selector */}
        <div className="flex gap-1.5 mb-3">
          {(['linkedin', 'instagram', 'facebook'] as SocialPlatform[]).map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors flex items-center gap-1 ${
                platform === p ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}>
              {PLATFORM_ICONS[p]} {p}
            </button>
          ))}
        </div>

        {/* Post type */}
        <div className="flex gap-1.5 mb-3">
          {(['text', 'image', 'link'] as PostType[]).map((t) => (
            <button key={t} onClick={() => setPostType(t)}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                postType === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              {POST_TYPE_ICONS[t]} {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Write your post..."
          className="w-full px-3 py-2 text-[12px] bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none h-24 mb-3" />

        {/* Hashtags */}
        <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)}
          placeholder="#hashtag1 #hashtag2"
          className="w-full px-3 py-1.5 text-[11px] bg-zinc-800/50 border border-white/10 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 mb-3" />

        {/* Time */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-[11px] text-zinc-400">⏰ Time:</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="h-7 text-[11px] bg-zinc-800/50 border border-white/10 rounded px-2 text-zinc-300 focus:outline-none" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-3 py-2 text-[12px] rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-300 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSchedule} disabled={!text.trim()}
            className="flex-1 px-3 py-2 text-[12px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-40 transition-colors">
            📅 Schedule
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Calendar Post Detail Panel ───────

function CalendarPostDetail({ post, onClose }: { post: SocialMediaPost; onClose: () => void }) {
  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const scheduledDate = post.scheduledAt || post.publishedAt || post.createdAt;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        variants={motionVariants.scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transitions.popSpring}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{PLATFORM_ICONS[post.platform]}</span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 capitalize">{post.platform} Post</h3>
              <p className="text-[10px] text-zinc-500">{formatDate(scheduledDate)} at {formatTime(scheduledDate)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
          <Badge className={`text-[9px] ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
          <Badge className="text-[9px] bg-white/10 text-zinc-300 border-white/10">
            {POST_TYPE_ICONS[post.postType]} {post.postType}
          </Badge>
          <Badge className="text-[9px] bg-white/10 text-zinc-300 border-white/10">
            {post.priority}
          </Badge>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
          <p className="text-[12px] text-zinc-300 whitespace-pre-wrap">{post.text}</p>
        </div>

        {post.hashtags.length > 0 && (
          <p className="text-[11px] text-sky-400 mb-2">{post.hashtags.join(' ')}</p>
        )}

        {post.imageUrl && (
          <p className="text-[10px] text-zinc-500 mb-1">🖼️ Image: {post.imageUrl.slice(0, 40)}...</p>
        )}

        {post.linkUrl && (
          <p className="text-[10px] text-zinc-500 mb-1">🔗 Link: {post.linkUrl.slice(0, 40)}...</p>
        )}

        {post.engagement && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-white/5">
            <span className="text-[10px] text-zinc-500">👍 {post.engagement.likes}</span>
            <span className="text-[10px] text-zinc-500">💬 {post.engagement.comments}</span>
            <span className="text-[10px] text-zinc-500">🔄 {post.engagement.shares}</span>
            <span className="text-[10px] text-zinc-500">👁 {post.engagement.impressions}</span>
          </div>
        )}

        {post.notes && (
          <p className="text-[10px] text-zinc-600 mt-2 italic">📝 {post.notes}</p>
        )}
      </motion.div>
    </div>
  );
}

// ─── Content Calendar ──────────────────

type CalendarView = 'month' | 'week';

function ContentCalendar({ posts, onSchedule, onBulkDelete, onBulkUpdate }: {
  posts: SocialMediaPost[];
  onSchedule: (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[]; scheduledAt: number }) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkUpdate: (ids: string[], updates: Record<string, unknown>) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [creatorDate, setCreatorDate] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const filteredPosts = useMemo(() => {
    if (platformFilter === 'all') return posts;
    return posts.filter((p) => p.platform === platformFilter);
  }, [posts, platformFilter]);

  // ── Month View ──
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    if (view === 'week') {
      // Week view: 7 days starting from Sunday
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

      const days: Array<{ date: Date; posts: SocialMediaPost[]; isCurrentMonth: boolean }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        const dayPosts = filteredPosts.filter((p) => {
          const ts = p.scheduledAt || p.publishedAt || p.createdAt;
          return ts >= dayStart && ts < dayEnd;
        });
        days.push({ date: d, posts: dayPosts, isCurrentMonth: d.getMonth() === month });
      }
      return days;
    }

    // Month view
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date; posts: SocialMediaPost[]; isCurrentMonth: boolean }> = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, posts: [], isCurrentMonth: false });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;
      const dayPosts = filteredPosts.filter((p) => {
        const ts = p.scheduledAt || p.publishedAt || p.createdAt;
        return ts >= dayStart && ts < dayEnd;
      });
      days.push({ date: d, posts: dayPosts, isCurrentMonth: true });
    }

    while (days.length % 7 !== 0) {
      const lastDate = days[days.length - 1].date;
      const d = new Date(lastDate.getTime() + 86400000);
      days.push({ date: d, posts: [], isCurrentMonth: false });
    }

    return days;
  }, [selectedDate, filteredPosts, view]);

  const navigatePrev = () => {
    if (view === 'week') {
      const prev = new Date(selectedDate);
      prev.setDate(prev.getDate() - 7);
      setSelectedDate(prev);
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
    }
  };

  const navigateNext = () => {
    if (view === 'week') {
      const next = new Date(selectedDate);
      next.setDate(next.getDate() + 7);
      setSelectedDate(next);
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));
    }
  };

  const navigateToday = () => setSelectedDate(new Date());

  const headerLabel = view === 'week'
    ? (() => {
        const start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const sameMonth = start.getMonth() === end.getMonth();
        if (sameMonth) {
          return `${start.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })} – ${end.getDate()}, ${end.getFullYear()}`;
        }
        return `${start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })()
    : selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const minH = view === 'week' ? 'min-h-[100px]' : 'min-h-[72px]';

  // Escape key to exit select mode
  useEffect(() => {
    if (!selectMode) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectMode(false); setSelectedPostIds(new Set()); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectMode]);

  const toggleSelectPost = useCallback((postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    const allVisibleIds = filteredPosts.map((p) => p.id);
    setSelectedPostIds(new Set(allVisibleIds));
  }, [filteredPosts]);

  const deselectAll = useCallback(() => {
    setSelectedPostIds(new Set());
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedPostIds.size === 0) return;
    const count = selectedPostIds.size;
    if (!window.confirm(`Delete ${count} post${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    onBulkDelete(Array.from(selectedPostIds));
    setSelectedPostIds(new Set());
    setSelectMode(false);
    toast.success(`🗑 Deleted ${count} post${count !== 1 ? 's' : ''}`, TOAST_DEFAULTS);
  }, [selectedPostIds, onBulkDelete]);

  const handleBulkCancelClick = useCallback(() => {
    if (selectedPostIds.size === 0) return;
    const count = selectedPostIds.size;
    if (!window.confirm(`Cancel ${count} post${count !== 1 ? 's' : ''}?`)) return;
    onBulkUpdate(Array.from(selectedPostIds), { status: 'cancelled' });
    setSelectedPostIds(new Set());
    setSelectMode(false);
    toast.success(`🚫 Cancelled ${count} post${count !== 1 ? 's' : ''}`, TOAST_DEFAULTS);
  }, [selectedPostIds, onBulkUpdate]);

  return (
    <>
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-zinc-300">📅 Content Calendar</CardTitle>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex bg-zinc-800/50 rounded-md p-0.5">
                {(['month', 'week'] as CalendarView[]).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      view === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {v === 'month' ? '🗓 Month' : '📋 Week'}
                  </button>
                ))}
              </div>

              {/* Platform filter */}
              <div className="flex bg-zinc-800/50 rounded-md p-0.5">
                {(['all', 'linkedin', 'instagram', 'facebook'] as const).map((p) => (
                  <button key={p} onClick={() => setPlatformFilter(p)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      platformFilter === p ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {p === 'all' ? '🌐 All' : `${PLATFORM_ICONS[p as SocialPlatform]} ${p}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button onClick={navigatePrev} className="text-zinc-500 hover:text-zinc-300 text-sm px-1">◀</button>
              <button onClick={navigateToday} className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors">Today</button>
              <button onClick={navigateNext} className="text-zinc-500 hover:text-zinc-300 text-sm px-1">▶</button>
              <span className="text-xs text-zinc-300 min-w-[180px] text-center font-medium">{headerLabel}</span>
            </div>
            <div className="text-[10px] text-zinc-600">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''} {platformFilter !== 'all' ? `on ${platformFilter}` : 'total'}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-[10px] text-zinc-500 text-center py-1 font-medium">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              const isToday = day.date.toDateString() === new Date().toDateString();
              const isPast = day.date.getTime() < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
              return (
                <div
                  key={i}
                  onClick={() => !isPast && setCreatorDate(day.date)}
                  className={`${minH} p-1.5 rounded-lg border transition-all cursor-pointer ${
                    day.isCurrentMonth
                      ? isToday
                        ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20'
                        : isPast
                          ? 'border-white/3 bg-zinc-800/20 opacity-60'
                          : 'border-white/5 bg-zinc-800/30 hover:bg-zinc-800/50 hover:border-white/10'
                    : 'border-transparent bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] ${
                      day.isCurrentMonth ? (isToday ? 'text-indigo-400 font-bold' : 'text-zinc-400') : 'text-zinc-700'
                    }`}>
                      {day.date.getDate()}
                    </span>
                    {day.posts.length > 0 && (
                      <span className="text-[8px] bg-white/10 text-zinc-400 rounded-full w-4 h-4 flex items-center justify-center">
                        {day.posts.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {day.posts.slice(0, view === 'week' ? 5 : 2).map((post) => (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          if (selectMode) {
                            toggleSelectPost(post.id, e);
                          } else {
                            e.stopPropagation();
                            setSelectedPost(post);
                          }
                        }}
                        className={`text-[8px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
                          selectedPostIds.has(post.id)
                            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-900 opacity-90'
                            : ''
                        } ${PLATFORM_COLORS[post.platform]} text-white`}
                        title={`${post.text} (${post.status})`}
                      >
                        {selectMode && (
                          <span className="mr-0.5">
                            {selectedPostIds.has(post.id) ? '☑' : '☐'}
                          </span>
                        )}
                        {PLATFORM_ICONS[post.platform]} {post.text.slice(0, view === 'week' ? 20 : 10)}
                      </div>
                    ))}
                    {day.posts.length > (view === 'week' ? 5 : 2) && (
                      <span className="text-[8px] text-zinc-500">+{day.posts.length - (view === 'week' ? 5 : 2)} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend + Select Mode Toggle */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-4">
              {(['linkedin', 'instagram', 'facebook'] as SocialPlatform[]).map((p) => (
                <div key={p} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-sm ${PLATFORM_COLORS[p]}`} />
                  <span className="text-[9px] text-zinc-500 capitalize">{p}</span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-indigo-500" />
                <span className="text-[9px] text-zinc-500">Today</span>
              </div>
              {selectedPostIds.size > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-amber-400" />
                  <span className="text-[9px] text-amber-400">Selected</span>
                </div>
              )}
            </div>
            <button
              onClick={() => { setSelectMode(!selectMode); if (selectMode) deselectAll(); }}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                selectMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-white/10'
              }`}
            >
              {selectMode ? '✓ Selecting' : '☑ Select'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectMode && selectedPostIds.size > 0 && (
          <motion.div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={transitions.popSpring}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-5 py-3 shadow-2xl">
              <span className="text-[12px] text-zinc-300 font-medium">
                {selectedPostIds.size} post{selectedPostIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="w-px h-5 bg-white/10" />
              <button
                onClick={selectAllVisible}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Select all visible
              </button>
              <button
                onClick={deselectAll}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Deselect all
              </button>
              <div className="w-px h-5 bg-white/10" />
              <button
                onClick={handleBulkCancelClick}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                🚫 Cancel
              </button>
              <button
                onClick={handleBulkDeleteClick}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20 transition-colors"
              >
                🗑 Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {creatorDate && (
          <CalendarPostCreator
            date={creatorDate}
            onClose={() => setCreatorDate(null)}
            onSchedule={(data) => {
              onSchedule(data);
              setCreatorDate(null);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedPost && (
          <CalendarPostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Analytics Chart ───────────────────

function AnalyticsChart({ stats }: { stats: ReturnType<typeof getPostStats> }) {
  const chartData = useMemo(() => {
    const platforms = ['linkedin', 'instagram', 'facebook', 'whatsapp'] as SocialPlatform[];
    return platforms.map((p) => ({
      name: `${PLATFORM_ICONS[p]} ${p}`,
      total: stats.byPlatform[p] || 0,
    }));
  }, [stats]);

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">📊 Posts by Platform</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Bar dataKey="total" name="Posts" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Queue Card ────────────────────────

function QueueCard({ queue }: { queue: PostQueueItem[] }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          ⏳ Publish Queue
          {queue.length > 0 && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">{queue.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="text-xs text-zinc-500">No posts in queue</p>
        ) : (
          <div className="space-y-2">
            {queue.slice(0, 10).map((item) => (
              <div key={item.postId} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <span>{PLATFORM_ICONS[item.platform]}</span>
                  <span className="text-[11px] text-zinc-300">{item.postId.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] ${
                    item.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : item.status === 'processing' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    : item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>{item.status}</Badge>
                  <span className="text-[9px] text-zinc-600">
                    {/* eslint-disable-next-line react-hooks/purity -- Date.now() is stable within a render cycle */}
                    {item.scheduledAt <= Date.now() ? 'Now' : formatTimeAgo(item.scheduledAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────

export function SocialMediaTab() {
  const [activeTab, setActiveTab] = useState<CalendarTab>('calendar');
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getPostStats>>({ total: 0, byPlatform: {} as Record<SocialPlatform, number>, byStatus: {} as Record<PostStatus, number>, scheduledCount: 0, publishedCount: 0, failedCount: 0 });
  const [queue, setQueue] = useState<PostQueueItem[]>([]);
  const [platforms, setPlatforms] = useState<Record<SocialPlatform, { configured: boolean; name: string }>>({
    linkedin: { configured: false, name: 'LinkedIn' },
    instagram: { configured: false, name: 'Instagram' },
    facebook: { configured: false, name: 'Facebook' },
    whatsapp: { configured: false, name: 'WhatsApp' },
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    try {
      setPosts(listPosts());
      setStats(getPostStats());
      setQueue(getQueue());
      setPlatforms(getPlatformStatus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleQuickPost = (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[] }) => {
    quickPost(data.platform, data.text, { postType: data.postType, hashtags: data.hashtags });
    loadData();
  };

  const handleSchedulePost = (data: { platform: SocialPlatform; text: string; postType: PostType; hashtags: string[]; scheduledAt: number }) => {
    schedulePost(data.platform, data.text, data.scheduledAt, { postType: data.postType, hashtags: data.hashtags });
    loadData();
  };

  const handleDelete = (id: string) => {
    deletePost(id);
    loadData();
  };

  const handleBulkDelete = (ids: string[]) => {
    for (const id of ids) {
      deletePost(id);
    }
    loadData();
  };

  const handleBulkUpdate = (ids: string[], updates: Record<string, unknown>) => {
    for (const id of ids) {
      updatePost(id, updates as Parameters<typeof updatePost>[1]);
    }
    loadData();
  };

  const handleExportCalendar = useCallback((format: 'csv' | 'ics') => {
    const postsToExport = posts.filter((p) => p.status === 'draft' || p.status === 'scheduled');
    if (postsToExport.length === 0) {
      toast.error('No draft/scheduled posts to export', TOAST_DEFAULTS);
      return;
    }
    const dateStr = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const csv = postsToCSV(postsToExport);
      downloadFile(csv, `content-calendar-${dateStr}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`📥 Exported ${postsToExport.length} posts as CSV`, TOAST_DEFAULTS);
    } else {
      const ics = postsToICS(postsToExport);
      downloadFile(ics, `content-calendar-${dateStr}.ics`, 'text/calendar;charset=utf-8;');
      toast.success(`📥 Exported ${postsToExport.length} posts as ICS`, TOAST_DEFAULTS);
    }
  }, [posts]);

  const handleCalendarImport = useCallback((service: 'google' | 'outlook') => {
    const postsToExport = posts.filter((p) => p.status === 'draft' || p.status === 'scheduled');
    if (postsToExport.length === 0) {
      toast.error('No draft/scheduled posts to import', TOAST_DEFAULTS);
      return;
    }
    const ics = postsToICS(postsToExport);
    if (postsToExport.length === 1) {
      // Single post: open direct import link for one-click import
      const post = postsToExport[0];
      const url = service === 'google' ? googleCalendarImportURL(post) : outlookImportURL(post);
      openCalendarImport(url);
      toast.success(`📆 Opening ${service === 'google' ? 'Google Calendar' : 'Outlook'}…`, TOAST_DEFAULTS);
    } else {
      // Multiple posts: encode ICS as data URI and open for bulk import
      const dataUri = icsToDataURI(ics);
      openCalendarImport(dataUri);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadFile(ics, `content-calendar-${dateStr}.ics`, 'text/calendar;charset=utf-8;');
      toast.success(`📆 ICS downloaded + opened — ${postsToExport.length} posts ready to import`, TOAST_DEFAULTS);
    }
  }, [posts]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading Social Media Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              📱 Social Media Hub
            </h2>
            <p className="text-sm text-zinc-500">
              Content calendar, post scheduling, and platform analytics
            </p>
          </div>
          <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
            {([['calendar', '📅 Calendar'], ['posts', '📝 Posts'], ['analytics', '📊 Analytics'], ['queue', '⏳ Queue']] as [CalendarTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-[11px] rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleExportCalendar('csv')} className="text-[11px]">
              📥 CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportCalendar('ics')} className="text-[11px]">
              📅 ICS
            </Button>
            <div className="relative group">
              <Button variant="outline" size="sm" className="text-[11px]">
                📆 Import to…
              </Button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
                <div className="rounded-lg border border-white/10 bg-zinc-900 shadow-2xl p-1 min-w-[160px]">
                  <button onClick={() => handleCalendarImport('google')}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5 rounded-md transition-colors">
                    📅 Google Calendar
                  </button>
                  <button onClick={() => handleCalendarImport('outlook')}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5 rounded-md transition-colors">
                    📧 Outlook
                  </button>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-[11px]">
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard title="Total Posts" value={stats.total} icon="📝" color="text-indigo-400" />
          <MetricCard title="Published" value={stats.publishedCount} subtitle="Live posts" icon="✅" color="text-emerald-400" />
          <MetricCard title="Scheduled" value={stats.scheduledCount} subtitle="Pending publish" icon="📅" color="text-amber-400" />
          <MetricCard title="Failed" value={stats.failedCount} subtitle="Needs attention" icon="❌" color="text-red-400" />
          <MetricCard title="Queue" value={queue.length} subtitle="In pipeline" icon="⏳" color="text-sky-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {activeTab === 'calendar' && <ContentCalendar posts={posts} onSchedule={handleSchedulePost} onBulkDelete={handleBulkDelete} onBulkUpdate={handleBulkUpdate} />}
            {activeTab === 'posts' && (
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-300">📝 All Posts ({posts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {posts.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-8">No posts yet. Create your first post above!</p>
                  ) : (
                    <div className="space-y-2">
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {activeTab === 'analytics' && <AnalyticsChart stats={stats} />}
            {activeTab === 'queue' && <QueueCard queue={queue} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <PostComposer onPost={handleQuickPost} onSchedule={handleSchedulePost} />
            <PlatformStatusCard platforms={platforms} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[10px] text-zinc-600">
            Social Media Hub · LinkedIn · Instagram · Facebook · WhatsApp
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
