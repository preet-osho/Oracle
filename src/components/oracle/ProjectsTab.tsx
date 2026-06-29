'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motionVariants, transitions, cardHoverProps, buttonTapProps } from '@/styles/design-tokens';
import { AGENCY_DOMAINS } from '@/data/domains';
import type { ClientProject, TimeEntry } from '@/types';
import toast from 'react-hot-toast';
import { TOAST_DEFAULTS } from '@/lib/toast-config';
import jsPDF from 'jspdf';

// ─── API Helpers ─────────────────────
import { projectsApi, timeEntriesApi, invoicesApi } from '@/lib/api';
import { calculateGST } from '@/lib/tax-calculator';
import { generateContract, CONTRACT_TEMPLATES, type ContractDetails } from '@/lib/contract-generator';
import { addExpense, deleteExpense, updateExpense, getExpensesByProject, getExpenseSummary, EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '@/lib/expense-tracker';
import { useSubscriptionState, UpgradeModal } from './FeatureGate';
import type { PlanId } from '@/lib/subscription';

async function loadProjects(): Promise<ClientProject[]> {
  try {
    const rows = await projectsApi.list();
    return rows.map((r) => ({
      id: r.id,
      clientName: r.client_name,
      industry: r.industry,
      sector: r.sector,
      service: r.service,
      status: r.status as ClientProject['status'],
      value: r.value,
      deadline: r.deadline || undefined,
      city: r.city,
      notes: r.notes,
      requirements: r.requirements || [],
      contacts: { name: r.contact_name, phone: r.contact_phone, email: r.contact_email },
      tags: r.tags || [],
      totalHours: r.total_hours,
      invoiceTotal: r.invoice_total,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch { toast.error('❌ Failed to load projects', TOAST_DEFAULTS); return []; }
}

async function loadTimeEntries(): Promise<TimeEntry[]> {
  try {
    const rows = await timeEntriesApi.list();
    return rows.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      description: r.description,
      hours: r.hours,
      rate: r.rate,
      date: r.date,
      billable: r.billable,
    }));
  } catch { toast.error('❌ Failed to load time entries', TOAST_DEFAULTS); return []; }
}

// ─── INDUSTRY DOMAINS ─────────────────
const INDUSTRIES = AGENCY_DOMAINS.map((d) => d.name).sort();
const STATUS_COLORS: Record<string, string> = {
  Active: 'var(--oracle-success)',
  Paused: 'var(--oracle-warning)',
  Complete: 'var(--oracle-info)',
  'On Hold': 'var(--oracle-text-muted)',
  Prospect: 'var(--oracle-primary-l)',
};

// ─── ProjectsTab ──────────────────────
export function ProjectsTab({ onAskOracle }: { onAskOracle?: (q: string) => void }) {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ClientProject | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showTimer, setShowTimer] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState<string | null>(null);
  const [showContract, setShowContract] = useState<string | null>(null);
  const [showExpenses, setShowExpenses] = useState<string | null>(null);
  const { plan } = useSubscriptionState();
  const invoicesAllowed = plan === 'pro' || plan === 'agency';
  const [invoiceModal, setInvoiceModal] = useState<{ open: boolean; requiredPlan: PlanId }>({ open: false, requiredPlan: 'pro' });

  useEffect(() => {
    loadProjects().then(setProjects);
    loadTimeEntries().then(setTimeEntries);
  }, []);





  const filtered = useMemo(() => {
    let result = projects;
    if (search) { const q = search.toLowerCase(); result = result.filter((p) => p.clientName.toLowerCase().includes(q) || p.industry.toLowerCase().includes(q)); }
    if (filterStatus !== 'All') result = result.filter((p) => p.status === filterStatus);
    return result;
  }, [projects, search, filterStatus]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'Active').length;
    const pipeline = projects.reduce((s, p) => s + (parseFloat(p.value.replace(/[₹,\s]/g, '')) || 0), 0);
    const overdue = projects.filter((p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'Complete').length;
    return { total, active, pipeline, overdue };
  }, [projects]);

  const handleAdd = useCallback(async (data: Omit<ClientProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await projectsApi.create({
        client_name: data.clientName,
        industry: data.industry,
        sector: data.sector,
        service: data.service,
        status: data.status,
        value: data.value,
        deadline: data.deadline || undefined,
        city: data.city,
        notes: data.notes,
        requirements: data.requirements,
        contact_name: data.contacts.name,
        contact_phone: data.contacts.phone,
        contact_email: data.contacts.email,
        tags: data.tags,
        total_hours: 0,
        invoice_total: 0,
      });
      const refreshed = await loadProjects();
      setProjects(refreshed);
      toast.success('✅ Project created successfully', TOAST_DEFAULTS);
    } catch { toast.error('❌ Failed to save project', TOAST_DEFAULTS); }
    setShowForm(false);
  }, []);

  const handleUpdate = useCallback(async (updated: ClientProject | Omit<ClientProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    const proj = updated as ClientProject;
    try {
      await projectsApi.update(proj.id, {
        client_name: proj.clientName,
        industry: proj.industry,
        sector: proj.sector,
        service: proj.service,
        status: proj.status,
        value: proj.value,
        deadline: proj.deadline || undefined,
        city: proj.city,
        notes: proj.notes,
        requirements: proj.requirements,
        contact_name: proj.contacts.name,
        contact_phone: proj.contacts.phone,
        contact_email: proj.contacts.email,
        tags: proj.tags,
      });
      const refreshed = await loadProjects();
      setProjects(refreshed);
      toast.success('✅ Project updated successfully', TOAST_DEFAULTS);
    } catch { toast.error('❌ Failed to update project', TOAST_DEFAULTS); }
    setEditingProject(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await projectsApi.delete(id);
      const refreshed = await loadProjects();
      setProjects(refreshed);
      toast.success('✅ Project deleted', TOAST_DEFAULTS);
    } catch { toast.error('❌ Failed to delete project', TOAST_DEFAULTS); }
  }, []);

  const handleAddTimeEntry = useCallback(async (entry: Omit<TimeEntry, 'id'>) => {
    try {
      await timeEntriesApi.create({
        client_id: entry.clientId,
        description: entry.description,
        hours: entry.hours,
        rate: entry.rate,
        date: entry.date,
        billable: entry.billable,
      });
      const refreshed = await loadTimeEntries();
      setTimeEntries(refreshed);
      toast.success('✅ Time entry logged', TOAST_DEFAULTS);
    } catch { toast.error('❌ Failed to log time entry', TOAST_DEFAULTS); }
  }, []);

  const handleGenerateInvoice = useCallback(async (project: ClientProject) => {
    const entries = timeEntries.filter((e) => e.clientId === project.id);
    const subtotal = entries.reduce((s, e) => s + e.hours * e.rate, 0);
    const gstBreakdown = calculateGST(subtotal, 18, false);
    try {
      await invoicesApi.create({
        client_id: project.id,
        client_name: project.clientName,
        items: entries.map((e) => ({ description: e.description, quantity: e.hours, rate: e.rate, amount: e.hours * e.rate })),
        subtotal,
        gst: gstBreakdown.totalTax,
        total: gstBreakdown.totalAmount,
        status: 'Draft',
        created_at: Date.now(),
        due_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      toast.success('✅ Invoice generated', TOAST_DEFAULTS);
    } catch { toast.error('❌ Failed to save invoice', TOAST_DEFAULTS); }
    setShowInvoice(project.id);
  }, [timeEntries]);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // ── PDF Invoice Export ──
  const handleExportPDF = useCallback((project: ClientProject, entries: TimeEntry[]) => {
    const doc = new jsPDF();
    const subtotal = entries.reduce((s, e) => s + e.hours * e.rate, 0);
    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 20, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('Generated by ORACLE — Universal Agency Intelligence', 20, 29);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, 22);
    doc.text(`Due: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`, 150, 29);

    // Divider
    doc.setDrawColor(200);
    doc.line(20, 34, 190, 34);

    // Client details
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE TO', 20, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(project.clientName, 20, 49);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`${project.city} · ${project.industry} · ${project.service}`, 20, 55);
    if (project.contacts.name) {
      doc.text(`Contact: ${project.contacts.name} | ${project.contacts.email} | ${project.contacts.phone}`, 20, 61);
    }

    // Table header
    let y = 72;
    doc.setFillColor(240, 244, 255);
    doc.rect(20, y - 4, 170, 8, 'F');
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description', 22, y);
    doc.text('Hours', 120, y);
    doc.text('Rate', 140, y);
    doc.text('Amount', 165, y);
    y += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const entry of entries) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(60);
      const desc = entry.description.length > 45 ? entry.description.slice(0, 42) + '...' : entry.description;
      doc.text(desc, 22, y);
      doc.text(String(entry.hours), 120, y);
      doc.text(`Rs.${entry.rate.toLocaleString('en-IN')}`, 140, y);
      doc.setTextColor(0);
      doc.text(`Rs.${(entry.hours * entry.rate).toLocaleString('en-IN')}`, 165, y);
      y += 7;
    }

    // Divider
    doc.setDrawColor(200);
    doc.line(120, y + 2, 190, y + 2);
    y += 8;

    // Totals
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Subtotal:', 130, y);
    doc.text(`Rs.${subtotal.toLocaleString('en-IN')}`, 165, y);
    y += 7;
    doc.text('GST (18%):', 130, y);
    doc.text(`Rs.${gst.toLocaleString('en-IN')}`, 165, y);
    y += 7;
    doc.setDrawColor(0);
    doc.line(130, y - 2, 190, y - 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text('Total:', 130, y + 4);
    doc.text(`Rs.${total.toLocaleString('en-IN')}`, 165, y + 4);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140);
    doc.text('Thank you for your business!', 20, 280);
    doc.text('This is a computer-generated invoice.', 20, 285);

    doc.save(`invoice-${project.clientName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`);
    toast.success('✅ PDF exported', TOAST_DEFAULTS);
  }, []);

  const daysUntil = (d?: string) => {
    if (!d) return null;
    // eslint-disable-next-line react-hooks/purity
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `⚠ Overdue by ${Math.abs(diff)} days`;
    if (diff === 0) return 'Due today';
    return `Due in ${diff} days`;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <motion.div variants={motionVariants.fadeUp} initial="initial" animate="animate" transition={transitions.smooth} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--oracle-text-1)]">📁 Projects</h1>
              <p className="mt-1 text-[13px] text-[var(--oracle-text-3)]">Manage client projects, time tracking, and invoices</p>
            </div>
            <motion.button {...buttonTapProps} onClick={() => { setEditingProject(null); setShowForm(true); }} className="rounded-xl oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white transition-all">
              + New Project
            </motion.button>
          </motion.div>

          {/* Stats Row */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total Projects', value: stats.total, icon: '📁' },
              { label: 'Active', value: stats.active, icon: '🟢' },
              { label: 'Pipeline Value', value: formatINR(stats.pipeline), icon: '💰' },
              { label: 'Overdue', value: stats.overdue, icon: '⚠️' },
            ].map((s) => (
              <div key={s.label} className="oracle-glass rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-[11px] text-[var(--oracle-text-muted)]">{s.label}</span>
                </div>
                <p className="mt-1 text-[18px] font-bold text-[var(--oracle-text-1)]">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none">
              {['All', 'Active', 'Paused', 'Complete', 'On Hold', 'Prospect'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Project Cards */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((project) => {
                const projectEntries = timeEntries.filter((e) => e.clientId === project.id);
                const totalHours = projectEntries.reduce((s, e) => s + e.hours, 0);
                const isExpanded = expandedId === project.id;
                return (
                  <motion.div key={project.id} layout variants={motionVariants.fadeUp} initial="initial" animate="animate" exit="exit" transition={transitions.smooth} {...cardHoverProps}>
                    <div className={`oracle-glass rounded-2xl p-4 transition-all ${isExpanded ? 'ring-1 ring-[var(--oracle-primary)]/30' : 'hover:border-[var(--oracle-border-strong)]'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[15px] font-bold text-[var(--oracle-text-1)]">{project.clientName}</h3>
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${STATUS_COLORS[project.status]}20`, color: STATUS_COLORS[project.status] }}>{project.status}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[var(--oracle-text-3)]">
                            <span>{project.city}</span>
                            <span>· {project.service}</span>
                            {project.value && <span className="font-semibold">{formatINR(parseFloat(project.value.replace(/[₹,\s]/g, '')) || 0)}</span>}
                            {project.deadline && <span className={daysUntil(project.deadline)?.startsWith('⚠') ? 'text-[var(--oracle-error)]' : ''}>{daysUntil(project.deadline)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <motion.button {...buttonTapProps} onClick={() => onAskOracle?.(`Tell me about client ${project.clientName} in ${project.industry}`)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Ask Oracle">⚡</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => setShowTimer(project.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Log Time">⏱</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => {
                            if (invoicesAllowed) {
                              handleGenerateInvoice(project);
                            } else {
                              setInvoiceModal({ open: true, requiredPlan: 'pro' });
                            }
                          }} className={`rounded-lg px-2 py-1 text-[11px] ${invoicesAllowed ? 'text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]' : 'text-[var(--oracle-warning)] opacity-60'}`} title={invoicesAllowed ? 'Invoice' : 'Upgrade to Invoice'}>{invoicesAllowed ? '📄' : '🔒'}</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => setShowExpenses(project.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Expenses">💸</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => setShowContract(project.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Generate Contract">📝</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => { setEditingProject(project); setShowForm(true); }} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:bg-[var(--oracle-card-hover)]" title="Edit">✏️</motion.button>
                          <motion.button {...buttonTapProps} onClick={() => handleDelete(project.id)} className="rounded-lg px-2 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]" title="Delete">🗑</motion.button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--oracle-text-muted)]">
                        <span>⏱ {totalHours.toFixed(1)}h logged</span>
                        <span>{projectEntries.length} entries</span>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transitions.smooth} className="overflow-hidden">
                            <div className="mt-4 space-y-4 border-t border-[var(--oracle-border)] pt-4">
                              {/* Requirements */}
                              {project.requirements.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-[12px] font-semibold text-[var(--oracle-text-1)]">Requirements</h4>
                                  <div className="space-y-1">
                                    {project.requirements.map((r, i) => (
                                      <label key={i} className="flex items-start gap-2 text-[12px] text-[var(--oracle-text-2)]">
                                        <input type="checkbox" className="mt-0.5 accent-[var(--oracle-primary)]" readOnly />
                                        {r}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Contact */}
                              {project.contacts && project.contacts.name && (
                                <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
                                  <h4 className="mb-1 text-[12px] font-semibold text-[var(--oracle-text-1)]">Contact</h4>
                                  <p className="text-[12px] text-[var(--oracle-text-3)]">
                                    {project.contacts.name} · {project.contacts.email}
                                    {project.contacts.phone && (
                                      <a href={`https://wa.me/${project.contacts.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--oracle-success)] underline">
                                        💬 WhatsApp
                                      </a>
                                    )}
                                  </p>
                                </div>
                              )}

                              {/* Time Entries */}
                              {projectEntries.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-[12px] font-semibold text-[var(--oracle-text-1)]">Time Entries ({totalHours.toFixed(1)}h)</h4>
                                  <div className="space-y-1">
                                    {projectEntries.slice(0, 5).map((e) => (
                                      <div key={e.id} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px]">
                                        <span className="text-[var(--oracle-text-2)]">{e.description}</span>
                                        <span className="text-[var(--oracle-text-muted)]">{e.hours}h × ₹{e.rate}/hr</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {project.notes && (
                                <div>
                                  <h4 className="mb-1 text-[12px] font-semibold text-[var(--oracle-text-1)]">Notes</h4>
                                  <p className="text-[12px] text-[var(--oracle-text-3)]">{project.notes}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-[var(--oracle-text-muted)]">
              <p className="text-[40px]">📁</p>
              <p className="mt-2 text-[14px]">{projects.length === 0 ? 'No projects yet. Click "+ New Project" to add one.' : 'No projects match your filters.'}</p>
            </div>
          )}

          {/* Time Tracker Modal */}
          <AnimatePresence>
            {showTimer && (
              <TimeTrackerModal
                projectId={showTimer}
                projectName={projects.find((p) => p.id === showTimer)?.clientName || ''}
                onClose={() => setShowTimer(null)}
                onSave={handleAddTimeEntry}
              />
            )}
          </AnimatePresence>

          {/* Expense Tracker Modal */}
      <AnimatePresence>
        {showExpenses && (
          <ExpenseTrackerModal
            projectId={showExpenses}
            projectName={projects.find((p) => p.id === showExpenses)?.clientName || ''}
            onClose={() => setShowExpenses(null)}
            onExpenseAdded={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Invoice Upgrade Modal */}
      <UpgradeModal
        open={invoiceModal.open}
        onOpenChange={(open) => setInvoiceModal((prev) => ({ ...prev, open }))}
        requiredPlan={invoiceModal.requiredPlan}
        featureLabel="Invoicing"
      />

      {/* Invoice Modal */}
          <AnimatePresence>
            {showInvoice && (
              <InvoiceModal
                project={projects.find((p) => p.id === showInvoice)!}
                entries={timeEntries.filter((e) => e.clientId === showInvoice)}
                onClose={() => setShowInvoice(null)}
                onExportPDF={() => {
                  const proj = projects.find((p) => p.id === showInvoice)!;
                  const entries = timeEntries.filter((e) => e.clientId === showInvoice);
                  handleExportPDF(proj, entries);
                }}
              />
            )}
          </AnimatePresence>

          {/* Contract Generator Modal */}
          <AnimatePresence>
            {showContract && (
              <ContractGeneratorModal
                project={projects.find((p) => p.id === showContract)!}
                onClose={() => setShowContract(null)}
              />
            )}
          </AnimatePresence>

          {/* Add/Edit Form */}
          <AnimatePresence>
            {showForm && (
              <ProjectForm
                project={editingProject}
                onSave={editingProject ? handleUpdate : handleAdd}
                onClose={() => { setShowForm(false); setEditingProject(null); }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Time Tracker Modal ───────────────
function TimeTrackerModal({ projectId, projectName, onClose, onSave }: { projectId: string; projectName: string; onClose: () => void; onSave: (e: Omit<TimeEntry, 'id'>) => void }) {
  const [desc, setDesc] = useState('');
  const [hours, setHours] = useState('1');
  const [rate, setRate] = useState('1500');
  const [mode, setMode] = useState<'manual' | 'timer'>('manual');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTime = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleSave = () => {
    const h = mode === 'timer' ? timerSeconds / 3600 : parseFloat(hours) || 0;
    if (!desc.trim() || h <= 0) return;
    onSave({ clientId: projectId, description: desc.trim(), hours: h, rate: parseFloat(rate) || 1500, date: Date.now(), billable: true });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-[17px] font-bold text-[var(--oracle-text-1)]">⏱ Log Time</h3>
        <p className="mb-4 text-[12px] text-[var(--oracle-text-muted)]">for {projectName}</p>

        <div className="mb-3 flex gap-2">
          <motion.button {...buttonTapProps} onClick={() => setMode('manual')} className={`flex-1 rounded-lg py-2 text-[12px] font-medium transition-all ${mode === 'manual' ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'text-[var(--oracle-text-muted)]'}`}>Manual Entry</motion.button>
          <motion.button {...buttonTapProps} onClick={() => setMode('timer')} className={`flex-1 rounded-lg py-2 text-[12px] font-medium transition-all ${mode === 'timer' ? 'bg-[var(--oracle-primary)]/10 text-[var(--oracle-primary-l)]' : 'text-[var(--oracle-text-muted)]'}`}>Timer</motion.button>
        </div>

        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What did you work on?" className="mb-3 w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />

        {mode === 'manual' ? (
          <div className="flex gap-3">
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Hours</label><input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" /></div>
            <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Rate (₹/hr)</label><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none focus:border-[var(--oracle-primary)]" /></div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="font-mono text-[32px] text-[var(--oracle-text-1)]">{formatTime(timerSeconds)}</p>
            <p className="mt-2 text-[12px] text-[var(--oracle-text-muted)]">Rate: ₹{rate}/hr</p>
            <motion.button {...buttonTapProps} onClick={() => setTimerRunning(!timerRunning)} className={`mt-3 rounded-xl px-6 py-2 text-[13px] font-semibold text-white transition-all ${timerRunning ? 'bg-[var(--oracle-error)]' : 'oracle-gradient-bg'}`}>
              {timerRunning ? '⏹ Stop' : '▶ Start Timer'}
            </motion.button>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">Save Entry</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Invoice Modal ────────────────────
function InvoiceModal({ project, entries, onClose, onExportPDF }: { project: ClientProject; entries: TimeEntry[]; onClose: () => void; onExportPDF: () => void }) {
  const subtotal = entries.reduce((s, e) => s + e.hours * e.rate, 0);
  const gstBreakdown = calculateGST(subtotal, 18, false);
  const gst = gstBreakdown.totalTax;
  const total = gstBreakdown.totalAmount;
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold text-[var(--oracle-text-1)]">📄 Invoice</h3>
          <motion.button {...buttonTapProps} onClick={onClose} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)]">✕</motion.button>
        </div>

        <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4 mb-4">
          <p className="text-[12px] text-[var(--oracle-text-muted)]">INVOICE TO</p>
          <p className="text-[14px] font-semibold text-[var(--oracle-text-1)]">{project.clientName}</p>
          <p className="text-[12px] text-[var(--oracle-text-3)]">{project.city} · {project.industry}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--oracle-border)]">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-[var(--oracle-surface-2)]">
              <th className="px-3 py-2 text-left font-semibold text-[var(--oracle-text-1)]">Description</th>
              <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Hours</th>
              <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Rate</th>
              <th className="px-3 py-2 text-right font-semibold text-[var(--oracle-text-1)]">Amount</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-[var(--oracle-border)]">
                  <td className="px-3 py-2 text-[var(--oracle-text-2)]">{e.description}</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{e.hours}</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-3)]">{formatINR(e.rate)}/hr</td>
                  <td className="px-3 py-2 text-right text-[var(--oracle-text-1)]">{formatINR(e.hours * e.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between"><span className="text-[var(--oracle-text-3)]">Subtotal</span><span className="text-[var(--oracle-text-1)]">{formatINR(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--oracle-text-3)]">CGST ({gstBreakdown.gstRate / 2}%)</span><span className="text-[var(--oracle-text-1)]">{formatINR(gstBreakdown.cgst)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--oracle-text-3)]">SGST ({gstBreakdown.gstRate / 2}%)</span><span className="text-[var(--oracle-text-1)]">{formatINR(gstBreakdown.sgst)}</span></div>
          <div className="flex justify-between border-t border-[var(--oracle-border)] pt-2 font-bold"><span className="text-[var(--oracle-text-1)]">Total (incl. GST)</span><span className="text-[var(--oracle-primary-l)]">{formatINR(total)}</span></div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Close</motion.button>
          <motion.button {...buttonTapProps} onClick={onExportPDF} className="rounded-lg bg-[var(--oracle-success)]/10 border border-[var(--oracle-success)]/30 px-4 py-2 text-[13px] font-semibold text-[var(--oracle-success)] hover:bg-[var(--oracle-success)]/20 transition-colors">📥 Export PDF</motion.button>
          <motion.button {...buttonTapProps} onClick={() => { navigator.clipboard.writeText(`Invoice for ${project.clientName}\n${entries.map((e) => `${e.description}: ${e.hours}h × ₹${e.rate} = ₹${e.hours * e.rate}`).join('\n')}\nSubtotal: ${formatINR(subtotal)}\nGST: ${formatINR(gst)}\nTotal: ${formatINR(total)}`); }} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">📋 Copy Invoice</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Project Form ─────────────────────
function ProjectForm({ project, onSave, onClose }: { project: ClientProject | null; onSave: (p: ClientProject | Omit<ClientProject, 'id' | 'createdAt' | 'updatedAt'>) => void; onClose: () => void }) {
  const [name, setName] = useState(project?.clientName || '');
  const [industry, setIndustry] = useState(project?.industry || INDUSTRIES[0]);
  const [service, setService] = useState(project?.service || '');
  const [status, setStatus] = useState<ClientProject['status']>(project?.status || 'Active');
  const [value, setValue] = useState(project?.value || '');
  const [deadline, setDeadline] = useState(project?.deadline || '');
  const [city, setCity] = useState(project?.city || '');
  const [notes, setNotes] = useState(project?.notes || '');
  const [requirements, setRequirements] = useState<string[]>(project?.requirements || []);
  const [newReq, setNewReq] = useState('');
  const [contactName, setContactName] = useState(project?.contacts?.name || '');
  const [contactPhone, setContactPhone] = useState(project?.contacts?.phone || '');
  const [contactEmail, setContactEmail] = useState(project?.contacts?.email || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setError('Client name is required.'); return; }
    const data = {
      ...(project || {}),
      clientName: name.trim(), industry, service, status, value, deadline, city, notes,
      requirements, contacts: { name: contactName, phone: contactPhone, email: contactEmail },
      tags: [],
    };
    onSave(data as ClientProject);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[17px] font-bold text-[var(--oracle-text-1)]">{project ? 'Edit Project' : 'New Project'}</h3>
        {error && <p className="mb-3 rounded-lg bg-[var(--oracle-error)]/10 px-3 py-2 text-[12px] text-[var(--oracle-error)]">{error}</p>}

        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client Name" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div className="flex gap-3">
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as ClientProject['status'])} className="rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-2)] outline-none">
              {['Active', 'Paused', 'Complete', 'On Hold', 'Prospect'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Service Type (e.g. SEO, Web Dev)" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
          <div className="flex gap-3">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value (₹)" className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none focus:border-[var(--oracle-primary)]" />
          </div>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />

          {/* Requirements */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Requirements</label>
            <div className="flex gap-2">
              <input value={newReq} onChange={(e) => setNewReq(e.target.value)} placeholder="Add requirement..." onKeyDown={(e) => { if (e.key === 'Enter' && newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } }} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
              <motion.button {...buttonTapProps} onClick={() => { if (newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } }} className="rounded-lg bg-[var(--oracle-primary)]/10 px-3 py-2 text-[12px] font-medium text-[var(--oracle-primary-l)]">Add</motion.button>
            </div>
            {requirements.length > 0 && (
              <div className="mt-2 space-y-1">
                {requirements.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-2)]">
                    <span>{r}</span>
                    <motion.button {...buttonTapProps} onClick={() => setRequirements(requirements.filter((_, j) => j !== i))} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">×</motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 space-y-2">
            <label className="block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Contact</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact Name" className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            <div className="flex gap-2">
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            </div>
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={3} className="w-full resize-none rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
          <motion.button {...buttonTapProps} onClick={handleSave} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">{project ? 'Update' : 'Create'} Project</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Contract Generator Modal ─────────
// ─── Expense Tracker Modal ──────────
function ExpenseTrackerModal({ projectId, projectName, onClose, onExpenseAdded }: { projectId: string; projectName: string; onClose: () => void; onExpenseAdded: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('software');
  const [recurring, setRecurring] = useState(false);
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load expenses for project
    setExpenses(getExpensesByProject(projectId));
  }, [projectId]);

  const summary = getExpenseSummary(expenses);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('software');
    setRecurring(false);
    setShowAddForm(false);
    setEditingExpense(null);
  };

  const handleAdd = () => {
    if (!description.trim() || !amount || parseFloat(amount) <= 0) return;
    const newExpense = addExpense({
      projectId,
      clientName: projectName,
      description: description.trim(),
      amount: parseFloat(amount),
      category,
      date: Date.now(),
      recurring,
    });
    setExpenses((prev) => [newExpense, ...prev]);
    resetForm();
    onExpenseAdded();
    toast.success('✅ Expense added', TOAST_DEFAULTS);
  };

  const handleEdit = () => {
    if (!editingExpense || !description.trim() || !amount || parseFloat(amount) <= 0) return;
    const updated = updateExpense(editingExpense.id, {
      description: description.trim(),
      amount: parseFloat(amount),
      category,
      recurring,
    });
    if (updated) {
      setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e));
      resetForm();
      onExpenseAdded();
      toast.success('✅ Expense updated', TOAST_DEFAULTS);
    }
  };

  const handleDelete = (id: string) => {
    deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    onExpenseAdded();
    toast.success('🗑 Expense removed', TOAST_DEFAULTS);
  };

  const startEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setRecurring(expense.recurring);
    setShowAddForm(false);
  };

  const isFormOpen = showAddForm || editingExpense !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[17px] font-bold text-[var(--oracle-text-1)]">💸 Expenses</h3>
            <p className="text-[12px] text-[var(--oracle-text-muted)]">{projectName}</p>
          </div>
          <motion.button {...buttonTapProps} onClick={onClose} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)]">✕</motion.button>
        </div>

        {/* Summary Cards */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <p className="text-[10px] text-[var(--oracle-text-muted)]">TOTAL SPENT</p>
            <p className="text-[14px] font-bold text-[var(--oracle-text-1)]">{formatINR(summary.total)}</p>
          </div>
          <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3">
            <p className="text-[10px] text-[var(--oracle-text-muted)]">RECURRING</p>
            <p className="text-[14px] font-bold text-[var(--oracle-warning)]">{formatINR(summary.recurringTotal)}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        {Object.keys(summary.byCategory).length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold text-[var(--oracle-text-muted)]">BY CATEGORY</p>
            <div className="space-y-1">
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px]">
                    <span className="text-[var(--oracle-text-2)]">{EXPENSE_CATEGORIES.find((c) => c.id === cat)?.icon} {cat}</span>
                    <span className="font-semibold text-[var(--oracle-text-1)]">{formatINR(total)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Add Button */}
        {!isFormOpen && (
          <div className="flex justify-end mb-3">
            <motion.button {...buttonTapProps} onClick={() => { resetForm(); setShowAddForm(true); }} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[12px] font-semibold text-white">
              + Add Expense
            </motion.button>
          </div>
        )}

        {/* Inline Add/Edit Form */}
        {isFormOpen && (
          <div className="mb-3 rounded-xl border border-[var(--oracle-primary)]/30 bg-[var(--oracle-surface-2)] p-4 space-y-2">
            <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{editingExpense ? '✏️ Edit Expense' : '➕ New Expense'}</p>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none" />
            <div className="flex gap-2">
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" className="flex-1 rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] outline-none" />
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="rounded-lg border border-[var(--oracle-border)] bg-[var(--oracle-bg)] px-3 py-2 text-[12px] text-[var(--oracle-text-2)] outline-none">
                {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-[var(--oracle-text-2)]">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="accent-[var(--oracle-primary)]" />
              Recurring expense
            </label>
            <div className="flex justify-end gap-2">
              <motion.button {...buttonTapProps} onClick={resetForm} className="rounded-lg px-3 py-1.5 text-[11px] text-[var(--oracle-text-muted)]">Cancel</motion.button>
              <motion.button {...buttonTapProps} onClick={editingExpense ? handleEdit : handleAdd} className="rounded-lg oracle-gradient-bg px-3 py-1.5 text-[11px] font-semibold text-white">
                {editingExpense ? 'Save Changes' : 'Add Expense'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Expense List */}
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="rounded-lg bg-[var(--oracle-surface-2)] p-3 transition-all hover:bg-[var(--oracle-surface-2)]/80">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--oracle-text-1)]">{exp.description}</p>
                  <p className="text-[10px] text-[var(--oracle-text-muted)]">
                    {EXPENSE_CATEGORIES.find((c) => c.id === exp.category)?.icon} {exp.category}
                    {exp.recurring && ' · 🔄 Recurring'}
                    {' · '}{new Date(exp.date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-[var(--oracle-text-1)]">{formatINR(exp.amount)}</span>
                  <motion.button {...buttonTapProps} onClick={() => startEdit(exp)} className="rounded-md px-1.5 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-info)] hover:bg-[var(--oracle-info)]/10" title="Edit">✏️</motion.button>
                  <motion.button {...buttonTapProps} onClick={() => handleDelete(exp.id)} className="rounded-md px-1.5 py-1 text-[11px] text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)] hover:bg-[var(--oracle-error)]/10" title="Delete">🗑</motion.button>
                </div>
              </div>
            </div>
          ))}
          {expenses.length === 0 && !isFormOpen && (
            <p className="py-4 text-center text-[12px] text-[var(--oracle-text-muted)]">No expenses yet. Click &quot;+ Add Expense&quot; to track costs.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Contract Generator Modal ─────────
function ContractGeneratorModal({ project, onClose }: { project: ClientProject; onClose: () => void }) {
  const [templateId, setTemplateId] = useState(CONTRACT_TEMPLATES[0].id);
  const [generated, setGenerated] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; });
  const [serviceDesc, setServiceDesc] = useState(project.service || '');
  const [amount, setAmount] = useState(project.value?.replace(/[₹,\s]/g, '') || '');
  const [paymentTerms, setPaymentTerms] = useState('50% upfront, 50% on completion');
  const [scopeItems, setScopeItems] = useState<string[]>(project.requirements.length > 0 ? project.requirements : ['Digital Marketing Services', 'Monthly Performance Reports', 'Strategy Consultation']);
  const [newScope, setNewScope] = useState('');

  const handleGenerate = () => {
    const details: ContractDetails = {
      clientName: project.clientName,
      clientAddress: project.city || 'India',
      agencyName: 'ORACLE Agency',
      agencyAddress: 'Mumbai, Maharashtra, India',
      serviceDescription: serviceDesc || project.service || 'Digital Services',
      totalAmount: parseFloat(amount) || 0,
      paymentTerms,
      startDate,
      endDate,
      scope: scopeItems,
    };
    const text = generateContract(templateId, details);
    setGenerated(text);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generated);
    toast.success('✅ Contract copied to clipboard', TOAST_DEFAULTS);
  };

  const handleDownload = () => {
    const blob = new Blob([generated], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${project.clientName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('✅ Contract downloaded', TOAST_DEFAULTS);
  };

  const selectedTemplate = CONTRACT_TEMPLATES.find((t) => t.id === templateId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="oracle-glass oracle-card-shadow w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold text-[var(--oracle-text-1)]">📝 Generate Contract</h3>
          <motion.button {...buttonTapProps} onClick={onClose} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-text-1)]">✕</motion.button>
        </div>

        <div className="rounded-xl bg-[var(--oracle-surface-2)] p-3 mb-4">
          <p className="text-[12px] text-[var(--oracle-text-muted)]">Generating contract for</p>
          <p className="text-[14px] font-semibold text-[var(--oracle-text-1)]">{project.clientName}</p>
        </div>

        {!generated ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Contract Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-2)] outline-none">
                {CONTRACT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="mt-1 text-[11px] text-[var(--oracle-text-muted)]">{selectedTemplate.sections.length} sections · Category: {selectedTemplate.category}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none" /></div>
              <div><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-2)] outline-none" /></div>
            </div>

            <input value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} placeholder="Service Description" className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2.5 text-[13px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />

            <div className="flex gap-3">
              <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Total Amount (₹)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none" /></div>
              <div className="flex-1"><label className="mb-1 block text-[11px] text-[var(--oracle-text-muted)]">Payment Terms</label><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[13px] text-[var(--oracle-text-1)] outline-none" /></div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[var(--oracle-text-muted)]">Scope Items</label>
              <div className="flex gap-2">
                <input value={newScope} onChange={(e) => setNewScope(e.target.value)} placeholder="Add scope item..." onKeyDown={(e) => { if (e.key === 'Enter' && newScope.trim()) { setScopeItems([...scopeItems, newScope.trim()]); setNewScope(''); } }} className="flex-1 rounded-xl border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-3 py-2 text-[12px] text-[var(--oracle-text-1)] placeholder:text-[var(--oracle-text-muted)] outline-none focus:border-[var(--oracle-primary)]" />
                <motion.button {...buttonTapProps} onClick={() => { if (newScope.trim()) { setScopeItems([...scopeItems, newScope.trim()]); setNewScope(''); } }} className="rounded-lg bg-[var(--oracle-primary)]/10 px-3 py-2 text-[12px] font-medium text-[var(--oracle-primary-l)]">Add</motion.button>
              </div>
              {scopeItems.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {scopeItems.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--oracle-surface-2)] px-3 py-1.5 text-[11px] text-[var(--oracle-text-2)]">
                      <span>{i + 1}. {s}</span>
                      <motion.button {...buttonTapProps} onClick={() => setScopeItems(scopeItems.filter((_, j) => j !== i))} className="text-[var(--oracle-text-muted)] hover:text-[var(--oracle-error)]">×</motion.button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <motion.button {...buttonTapProps} onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">Cancel</motion.button>
              <motion.button {...buttonTapProps} onClick={handleGenerate} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">⚡ Generate Contract</motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--oracle-surface-2)] p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-[12px] font-mono text-[var(--oracle-text-2)] leading-relaxed">{generated}</pre>
            </div>
            <div className="flex justify-end gap-2">
              <motion.button {...buttonTapProps} onClick={() => setGenerated('')} className="rounded-lg border border-[var(--oracle-border)] px-4 py-2 text-[13px] text-[var(--oracle-text-3)] hover:bg-[var(--oracle-card-hover)]">← Edit</motion.button>
              <motion.button {...buttonTapProps} onClick={handleCopy} className="rounded-lg bg-[var(--oracle-success)]/10 border border-[var(--oracle-success)]/30 px-4 py-2 text-[13px] font-semibold text-[var(--oracle-success)]">📋 Copy</motion.button>
              <motion.button {...buttonTapProps} onClick={handleDownload} className="rounded-lg oracle-gradient-bg px-4 py-2 text-[13px] font-semibold text-white">📥 Download</motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
