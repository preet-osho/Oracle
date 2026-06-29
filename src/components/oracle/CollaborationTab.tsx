'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions, buttonTapProps } from '@/styles/design-tokens';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import { nanoid } from 'nanoid';

// ─── Types ─────────────────────────────

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastActive: number;
}

interface ProjectActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: number;
}

interface SharedProject {
  id: string;
  name: string;
  description: string;
  collaborators: string[];
  isPublic: boolean;
  lastEditedBy: string;
  lastEditedAt: number;
  createdAt: number;
}

// ─── Sample Data ───────────────────────

const SAMPLE_COLLABORATORS: Collaborator[] = [
  { id: '1', name: 'Preet Osho', email: 'preet@oracledigital.in', role: 'owner', avatar: '👤', status: 'online', lastActive: Date.now() },
  { id: '2', name: 'Priya Sharma', email: 'priya@oracledigital.in', role: 'admin', avatar: '👩', status: 'online', lastActive: Date.now() - 300000 },
  { id: '3', name: 'Rahul Verma', email: 'rahul@oracledigital.in', role: 'editor', avatar: '👨', status: 'away', lastActive: Date.now() - 1800000 },
  { id: '4', name: 'Ananya Patel', email: 'ananya@oracledigital.in', role: 'viewer', avatar: '👩‍💼', status: 'offline', lastActive: Date.now() - 86400000 },
];

const SAMPLE_ACTIVITY: ProjectActivity[] = [
  { id: '1', userId: '1', userName: 'Preet', action: 'updated proposal for', target: 'Restaurant Client', timestamp: Date.now() - 300000 },
  { id: '2', userId: '2', userName: 'Priya', action: 'added new lead:', target: 'Delhi Fitness Studio', timestamp: Date.now() - 600000 },
  { id: '3', userId: '3', userName: 'Rahul', action: 'generated invoice for', target: 'TechStart Solutions', timestamp: Date.now() - 1200000 },
  { id: '4', userId: '1', userName: 'Preet', action: 'created chatbot flow:', target: 'Lead Capture Bot', timestamp: Date.now() - 3600000 },
  { id: '5', userId: '2', userName: 'Priya', action: 'commented on', target: 'SEO Audit Report', timestamp: Date.now() - 7200000 },
];

const SAMPLE_PROJECTS: SharedProject[] = [
  { id: '1', name: 'Restaurant Client - Full Stack', description: 'Website, SEO, WhatsApp ordering, social media', collaborators: ['1', '2', '3'], isPublic: false, lastEditedBy: 'Preet', lastEditedAt: Date.now() - 300000, createdAt: Date.now() - 86400000 * 7 },
  { id: '2', name: 'D2C Skincare Brand', description: 'Meta Ads, Influencer Marketing, Shopify Store', collaborators: ['1', '2'], isPublic: false, lastEditedBy: 'Priya', lastEditedAt: Date.now() - 600000, createdAt: Date.now() - 86400000 * 14 },
  { id: '3', name: 'SaaS Startup Growth', description: 'Landing page, Google Ads, Content Marketing', collaborators: ['1', '2', '3', '4'], isPublic: true, lastEditedBy: 'Rahul', lastEditedAt: Date.now() - 1200000, createdAt: Date.now() - 86400000 * 3 },
];

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]',
  admin: 'bg-[var(--oracle-warning)]/10 text-[var(--oracle-warning)]',
  editor: 'bg-[var(--oracle-success)]/10 text-[var(--oracle-success)]',
  viewer: 'bg-[var(--oracle-surface-2)] text-[var(--oracle-text-muted)]',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-[var(--oracle-success)]',
  away: 'bg-[var(--oracle-warning)]',
  offline: 'bg-[var(--oracle-text-muted)]',
};

// ─── Collaboration Tab ─────────────────

export function CollaborationTab() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>(SAMPLE_COLLABORATORS);
  const [activity] = useState<ProjectActivity[]>(SAMPLE_ACTIVITY);
  const [projects] = useState<SharedProject[]>(SAMPLE_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<SharedProject | null>(SAMPLE_PROJECTS[0]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');

  const inviteCollaborator = useCallback(() => {
    if (!inviteEmail.trim()) { toast.error('❌ Email required', TOAST_DEFAULTS); return; }
    const collab: Collaborator = {
      id: nanoid(), name: inviteEmail.split('@')[0], email: inviteEmail,
      role: inviteRole, avatar: '👤', status: 'offline', lastActive: 0,
    };
    setCollaborators((prev) => [...prev, collab]);
    setInviteEmail('');
    setShowInvite(false);
    toast.success(`✅ Invitation sent to ${inviteEmail}`, TOAST_DEFAULTS);
  }, [inviteEmail, inviteRole]);

  const changeRole = useCallback((collabId: string, newRole: Collaborator['role']) => {
    setCollaborators((prev) => prev.map((c) => c.id === collabId ? { ...c, role: newRole } : c));
    toast.success('Role updated', TOAST_DEFAULTS);
  }, []);

  const removeCollaborator = useCallback((collabId: string) => {
    setCollaborators((prev) => prev.filter((c) => c.id !== collabId));
    toast.success('Collaborator removed', TOAST_DEFAULTS);
  }, []);

  // eslint-disable-next-line react-hooks/purity
  const nowRef = useRef(Date.now());

  const formatTime = useCallback((timestamp: number) => {
    const diff = nowRef.current - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6">
            <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">👥 Team Collaboration</h1>
            <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Real-time collaboration with your team using Supabase Realtime</p>
          </motion.div>

          <div className="grid grid-cols-12 gap-4">
            {/* Left - Collaborators */}
            <div className="col-span-4">
              <div className="oracle-glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)]">Team Members ({collaborators.length})</h3>
                  <motion.button {...buttonTapProps} onClick={() => setShowInvite(!showInvite)} className="text-[11px] text-[var(--oracle-primary-l)] font-medium hover:underline">+ Invite</motion.button>
                </div>

                {showInvite && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-3 overflow-hidden">
                    <div className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] p-3">
                      <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="mb-2 w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[11px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" onKeyDown={(e) => e.key === 'Enter' && inviteCollaborator()} />
                      <div className="flex gap-2">
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-2 py-1.5 text-[10px] text-[var(--oracle-text-2)] outline-none">
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button onClick={inviteCollaborator} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[10px] font-medium text-white">Send</button>
                        <button onClick={() => setShowInvite(false)} className="rounded-lg bg-[var(--oracle-surface-2)] px-2 py-1.5 text-[10px] text-[var(--oracle-text-muted)]">✕</button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  {collaborators.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--oracle-card-hover)] transition-colors">
                      <div className="relative">
                        <span className="text-xl">{c.avatar}</span>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--oracle-bg)] ${STATUS_COLORS[c.status]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--oracle-text-2)] truncate">{c.name}</p>
                        <p className="text-[10px] text-[var(--oracle-text-muted)] truncate">{c.email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <select value={c.role} onChange={(e) => changeRole(c.id, e.target.value as typeof c.role)} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium outline-none ${ROLE_COLORS[c.role]}`}>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {c.role !== 'owner' && (
                          <button onClick={() => removeCollaborator(c.id)} className="text-[9px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Center - Projects */}
            <div className="col-span-5">
              <div className="oracle-glass rounded-2xl p-4">
                <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)] mb-3">Shared Projects</h3>
                <div className="space-y-3">
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {projects.map((project) => (
                    <div key={project.id} onClick={() => setSelectedProject(project)} className={`cursor-pointer rounded-xl p-4 transition-all ${selectedProject?.id === project.id ? 'bg-[var(--oracle-primary)]/10 border border-[var(--oracle-primary)]/30' : 'border border-[var(--oracle-border)] hover:border-[var(--oracle-border-strong)]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[13px] font-semibold text-[var(--oracle-text-1)]">{project.name}</p>
                        {project.isPublic && <span className="rounded-full bg-[var(--oracle-info)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--oracle-info)]">Public</span>}
                      </div>
                      <p className="text-[11px] text-[var(--oracle-text-3)] mb-2">{project.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {project.collaborators.slice(0, 4).map((cid) => {
                            const c = collaborators.find((x) => x.id === cid);
                            return c ? <span key={cid} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--oracle-bg)] bg-[var(--oracle-surface-2)] text-[10px]">{c.avatar}</span> : null;
                          })}
                          {project.collaborators.length > 4 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--oracle-bg)] bg-[var(--oracle-surface-2)] text-[8px] font-medium text-[var(--oracle-text-muted)]">
                              +{project.collaborators.length - 4}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--oracle-text-muted)]">Edited by {project.lastEditedBy} · {formatTime(project.lastEditedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Activity Feed */}
            <div className="col-span-3">
              <div className="oracle-glass rounded-2xl p-4">
                <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)] mb-3">Activity Feed</h3>
                <div className="space-y-3">
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--oracle-primary)]" />
                      <div>
                        <p className="text-[11px] text-[var(--oracle-text-3)]">
                          <span className="font-medium text-[var(--oracle-text-2)]">{a.userName}</span> {a.action} <span className="font-medium text-[var(--oracle-primary-l)]">{a.target}</span>
                        </p>
                        <p className="text-[9px] text-[var(--oracle-text-muted)]">{formatTime(a.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Online Now */}
              <div className="oracle-glass rounded-2xl p-4 mt-4">
                <h3 className="text-[13px] font-semibold text-[var(--oracle-text-1)] mb-2">Online Now</h3>
                <div className="space-y-2">
                  {collaborators.filter((c) => c.status === 'online').map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="relative">
                        <span className="text-lg">{c.avatar}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--oracle-success)] border-2 border-[var(--oracle-bg)]" />
                      </span>
                      <span className="text-[11px] font-medium text-[var(--oracle-text-2)]">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
