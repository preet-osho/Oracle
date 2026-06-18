// ═══════════════════════════════════════
// ORACLE — Scope Change & Approval Types
// ═══════════════════════════════════════

export interface ScopeChange {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  requestedBy: string;
  originalEstimate: number;
  revisedEstimate: number;
  additionalCost: number;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Implemented';
  reason: string;
  createdAt: number;
  resolvedAt?: number;
  notes?: string;
}

export interface ApprovalItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  deliverable: string;
  type: 'Milestone' | 'Deliverable' | 'Change Request' | 'Invoice';
  status: 'Pending' | 'Approved' | 'Revision Requested' | 'Rejected';
  submittedAt: number;
  reviewedAt?: number;
  reviewerName?: string;
  comments?: string;
  files?: string[];
}
