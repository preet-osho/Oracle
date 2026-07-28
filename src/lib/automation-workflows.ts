// ═══════════════════════════════════════
// ORACLE — Automation Workflows
// Lead Capture · CRM Sync · Follow-Up · Appointment Booking
// ═══════════════════════════════════════

import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { getStored, setStored } from '@/lib/storage-utils';

const log = createLogger('AutomationWorkflows');

// ─── Types ─────────────────────────────

export type WorkflowTrigger =
  | 'form-submission'
  | 'new-lead'
  | 'deal-stage-change'
  | 'activity-completed'
  | 'scheduled'
  | 'manual';

export type WorkflowAction =
  | 'send-email'
  | 'send-whatsapp'
  | 'create-task'
  | 'update-deal'
  | 'create-activity'
  | 'send-notification'
  | 'add-to-sequence'
  | 'webhook';

export type WorkflowStatus = 'active' | 'paused' | 'draft' | 'error';

export interface WorkflowStep {
  id: string;
  name: string;
  action: WorkflowAction;
  config: Record<string, unknown>;
  delayMinutes?: number;
  conditions?: WorkflowCondition[];
  nextStepId?: string;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater-than' | 'less-than' | 'exists';
  value: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  executionCount: number;
  lastExecutedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  trigger: WorkflowTrigger;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStepId: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  context: Record<string, unknown>;
}

export interface FollowUpSequence {
  id: string;
  name: string;
  leadId: string;
  steps: FollowUpStep[];
  status: 'active' | 'completed' | 'paused';
  currentStep: number;
  startedAt: number;
  nextFollowUpAt?: number;
}

export interface FollowUpStep {
  day: number;
  channel: 'email' | 'whatsapp' | 'linkedin' | 'phone';
  template: string;
  subject?: string;
  status: 'pending' | 'sent' | 'skipped';
  sentAt?: number;
}

export interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  duration: number;
  available: boolean;
  bookedBy?: string;
  bookedAt?: number;
}

// ─── Storage ───────────────────────────

const WORKFLOWS_KEY = 'oracle_workflows';
const EXECUTIONS_KEY = 'oracle_workflow_executions';
const FOLLOWUPS_KEY = 'oracle_followup_sequences';
const APPOINTMENTS_KEY = 'oracle_appointment_slots';

// ─── Workflow Management ───────────────

export function getAllWorkflows(): Workflow[] {
  return getStored<Workflow>(WORKFLOWS_KEY);
}

export function getWorkflowById(id: string): Workflow | undefined {
  return getAllWorkflows().find((w) => w.id === id);
}

export function getWorkflowsByTrigger(trigger: WorkflowTrigger): Workflow[] {
  return getAllWorkflows().filter((w) => w.trigger === trigger && w.status === 'active');
}

export function createWorkflow(
  data: Omit<Workflow, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'>,
): Workflow {
  const workflows = getAllWorkflows();
  const workflow: Workflow = {
    ...data,
    id: nanoid(),
    executionCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  workflows.push(workflow);
  setStored(WORKFLOWS_KEY, workflows);
  log.info('Workflow created', { id: workflow.id, name: workflow.name });
  return workflow;
}

export function updateWorkflow(
  id: string,
  updates: Partial<Omit<Workflow, 'id' | 'createdAt'>>,
): Workflow | null {
  const workflows = getAllWorkflows();
  const index = workflows.findIndex((w) => w.id === id);
  if (index === -1) return null;

  workflows[index] = { ...workflows[index], ...updates, updatedAt: Date.now() };
  setStored(WORKFLOWS_KEY, workflows);
  return workflows[index];
}

export function deleteWorkflow(id: string): boolean {
  const workflows = getAllWorkflows();
  const filtered = workflows.filter((w) => w.id !== id);
  if (filtered.length === workflows.length) return false;
  setStored(WORKFLOWS_KEY, filtered);
  return true;
}

// ─── Workflow Execution ────────────────

export async function executeWorkflow(
  workflowId: string,
  context: Record<string, unknown>,
): Promise<WorkflowExecution | null> {
  const workflow = getWorkflowById(workflowId);
  if (!workflow || workflow.status !== 'active') {
    log.warn('Cannot execute workflow', { workflowId, status: workflow?.status });
    return null;
  }

  const execution: WorkflowExecution = {
    id: nanoid(),
    workflowId,
    trigger: workflow.trigger,
    status: 'running',
    currentStepId: workflow.steps[0]?.id || '',
    startedAt: Date.now(),
    context,
  };

  // Store execution
  const executions = getStored<WorkflowExecution>(EXECUTIONS_KEY);
  executions.push(execution);
  setStored(EXECUTIONS_KEY, executions);

  // Execute steps
  try {
    await executeWorkflowSteps(workflow, execution);
    execution.status = 'completed';
    execution.completedAt = Date.now();

    // Update workflow stats
    updateWorkflow(workflowId, {
      executionCount: workflow.executionCount + 1,
      lastExecutedAt: Date.now(),
    });
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : 'Unknown error';
    log.error('Workflow execution failed', { workflowId, error: execution.error });
  }

  // Update execution
  const updatedExecutions = getStored<WorkflowExecution>(EXECUTIONS_KEY);
  const execIndex = updatedExecutions.findIndex((e) => e.id === execution.id);
  if (execIndex !== -1) {
    updatedExecutions[execIndex] = execution;
    setStored(EXECUTIONS_KEY, updatedExecutions);
  }

  return execution;
}

async function executeWorkflowSteps(
  workflow: Workflow,
  execution: WorkflowExecution,
): Promise<void> {
  let currentStep = workflow.steps.find((s) => s.id === execution.currentStepId);

  while (currentStep) {
    // Check conditions
    if (currentStep.conditions && currentStep.conditions.length > 0) {
      const conditionsMet = checkConditions(currentStep.conditions, execution.context);
      if (!conditionsMet) {
        log.info('Workflow step conditions not met', {
          stepId: currentStep.id,
          stepName: currentStep.name,
        });
        // Skip to next step
        currentStep = currentStep.nextStepId
          ? workflow.steps.find((s) => s.id === currentStep!.nextStepId)
          : undefined;
        continue;
      }
    }

    // Apply delay if specified
    if (currentStep.delayMinutes && currentStep.delayMinutes > 0) {
      await new Promise((resolve) => setTimeout(resolve, currentStep!.delayMinutes! * 60 * 1000));
    }

    // Execute action
    await executeWorkflowAction(currentStep, execution);

    // Move to next step
    currentStep = currentStep.nextStepId
      ? workflow.steps.find((s) => s.id === currentStep!.nextStepId)
      : undefined;
  }
}

function checkConditions(
  conditions: WorkflowCondition[],
  context: Record<string, unknown>,
): boolean {
  return conditions.every((condition) => {
    const value = context[condition.field];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return String(value) === conditionValue;
      case 'contains':
        return String(value).toLowerCase().includes(conditionValue.toLowerCase());
      case 'greater-than':
        return Number(value) > Number(conditionValue);
      case 'less-than':
        return Number(value) < Number(conditionValue);
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return true;
    }
  });
}

async function executeWorkflowAction(
  step: WorkflowStep,
  execution: WorkflowExecution,
): Promise<void> {
  log.info('Executing workflow step', { stepId: step.id, action: step.action });

  switch (step.action) {
    case 'send-email':
      // Would integrate with email service
      log.info('Email action triggered', { config: step.config });
      break;

    case 'send-whatsapp':
      // Would integrate with WhatsApp service
      log.info('WhatsApp action triggered', { config: step.config });
      break;

    case 'create-task':
      // Would create a task
      log.info('Task creation triggered', { config: step.config });
      break;

    case 'update-deal':
      // Would update deal in CRM
      log.info('Deal update triggered', { config: step.config });
      break;

    case 'create-activity':
      // Would create activity in CRM
      log.info('Activity creation triggered', { config: step.config });
      break;

    case 'send-notification':
      // Would send notification
      log.info('Notification triggered', { config: step.config });
      break;

    case 'add-to-sequence':
      // Would add lead to follow-up sequence
      log.info('Sequence add triggered', { config: step.config });
      break;

    case 'webhook':
      // Would call external webhook
      log.info('Webhook triggered', { config: step.config });
      break;
  }
}

// ─── Follow-Up Sequences ───────────────

export function getAllFollowUpSequences(): FollowUpSequence[] {
  return getStored<FollowUpSequence>(FOLLOWUPS_KEY);
}

export function getFollowUpSequenceById(id: string): FollowUpSequence | undefined {
  return getAllFollowUpSequences().find((s) => s.id === id);
}

export function getFollowUpSequencesByLead(leadId: string): FollowUpSequence[] {
  return getAllFollowUpSequences().filter((s) => s.leadId === leadId);
}

export function createFollowUpSequence(
  data: Omit<FollowUpSequence, 'id' | 'currentStep' | 'startedAt'>,
): FollowUpSequence {
  const sequences = getAllFollowUpSequences();
  const sequence: FollowUpSequence = {
    ...data,
    id: nanoid(),
    currentStep: 0,
    startedAt: Date.now(),
  };
  sequences.push(sequence);
  setStored(FOLLOWUPS_KEY, sequences);
  log.info('Follow-up sequence created', { id: sequence.id, leadId: sequence.leadId });
  return sequence;
}

export function advanceFollowUpSequence(sequenceId: string): FollowUpSequence | null {
  const sequences = getAllFollowUpSequences();
  const index = sequences.findIndex((s) => s.id === sequenceId);
  if (index === -1) return null;

  const sequence = sequences[index];
  if (sequence.status !== 'active') return null;

  sequence.currentStep++;

  // Check if sequence is complete
  if (sequence.currentStep >= sequence.steps.length) {
    sequence.status = 'completed';
  } else {
    // Calculate next follow-up time
    const nextStep = sequence.steps[sequence.currentStep];
    const nextDate = new Date(sequence.startedAt);
    nextDate.setDate(nextDate.getDate() + nextStep.day);
    sequence.nextFollowUpAt = nextDate.getTime();
  }

  sequences[index] = sequence;
  setStored(FOLLOWUPS_KEY, sequences);
  return sequence;
}

export function pauseFollowUpSequence(sequenceId: string): boolean {
  const sequences = getAllFollowUpSequences();
  const index = sequences.findIndex((s) => s.id === sequenceId);
  if (index === -1) return false;

  sequences[index].status = 'paused';
  setStored(FOLLOWUPS_KEY, sequences);
  return true;
}

export function resumeFollowUpSequence(sequenceId: string): boolean {
  const sequences = getAllFollowUpSequences();
  const index = sequences.findIndex((s) => s.id === sequenceId);
  if (index === -1) return false;

  sequences[index].status = 'active';
  setStored(FOLLOWUPS_KEY, sequences);
  return true;
}

// ─── Appointment Booking ───────────────

export function getAppointmentSlots(date?: string): AppointmentSlot[] {
  const slots = getStored<AppointmentSlot>(APPOINTMENTS_KEY);

  if (date) {
    return slots.filter((s) => s.date === date);
  }

  return slots;
}

export function createAppointmentSlot(
  data: Omit<AppointmentSlot, 'id' | 'available'>,
): AppointmentSlot {
  const slots = getStored<AppointmentSlot>(APPOINTMENTS_KEY);
  const slot: AppointmentSlot = {
    ...data,
    id: nanoid(),
    available: true,
  };
  slots.push(slot);
  setStored(APPOINTMENTS_KEY, slots);
  return slot;
}

export function bookAppointment(
  slotId: string,
  bookedBy: string,
): AppointmentSlot | null {
  const slots = getStored<AppointmentSlot>(APPOINTMENTS_KEY);
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1 || !slots[index].available) return null;

  slots[index].available = false;
  slots[index].bookedBy = bookedBy;
  slots[index].bookedAt = Date.now();
  setStored(APPOINTMENTS_KEY, slots);

  log.info('Appointment booked', { slotId, bookedBy });
  return slots[index];
}

export function cancelAppointment(slotId: string): boolean {
  const slots = getStored<AppointmentSlot>(APPOINTMENTS_KEY);
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) return false;

  slots[index].available = true;
  slots[index].bookedBy = undefined;
  slots[index].bookedAt = undefined;
  setStored(APPOINTMENTS_KEY, slots);

  log.info('Appointment cancelled', { slotId });
  return true;
}

export function getAvailableSlotsForDate(date: string): AppointmentSlot[] {
  return getAppointmentSlots(date).filter((s) => s.available);
}

// ─── Template Helpers ──────────────────

export function generateFollowUpSequence(
  leadName: string,
  companyName: string,
  service: string,
): FollowUpStep[] {
  const steps: FollowUpStep[] = [
    {
      day: 0,
      channel: 'email',
      subject: `Quick question about ${companyName}'s ${service}`,
      template: `Hi ${leadName},\n\nI noticed ${companyName} could benefit from better ${service}. We've helped similar companies increase their results by 40%.\n\nWould you be open to a 15-minute call this week?\n\nBest,\nOracle Digital`,
      status: 'pending',
    },
    {
      day: 3,
      channel: 'whatsapp',
      template: `Hi ${leadName} 👋\n\nJust following up on my email about ${service} for ${companyName}. \n\nWould love to share how we can help. Can we chat for 10 minutes?\n\n— Oracle Digital`,
      status: 'pending',
    },
    {
      day: 7,
      channel: 'email',
      subject: `Case study: How similar companies improved ${service}`,
      template: `Hi ${leadName},\n\nI wanted to share a quick case study of how we helped a company similar to ${companyName} achieve:\n\n• 45% increase in leads\n• 3x ROI on marketing spend\n• 60% reduction in cost per acquisition\n\nWould this be valuable for ${companyName}?\n\nBest,\nOracle Digital`,
      status: 'pending',
    },
    {
      day: 14,
      channel: 'linkedin',
      template: `Hi ${leadName},\n\nI've been following ${companyName}'s growth and have some ideas on how we could help with ${service}.\n\nWould you be open to a quick chat? I promise it'll be worth your time.\n\nBest,\nOracle Digital`,
      status: 'pending',
    },
    {
      day: 21,
      channel: 'email',
      subject: `Last thought on ${service} for ${companyName}`,
      template: `Hi ${leadName},\n\nI know you're busy, so I'll keep this brief.\n\nWe have a limited-time offer: a free ${service} audit for companies like ${companyName}.\n\nNo strings attached. Just actionable insights you can use immediately.\n\nInterested?\n\nBest,\nOracle Digital`,
      status: 'pending',
    },
  ];
  return steps;
}

export function generateBookingConfirmation(
  clientName: string,
  date: string,
  time: string,
  meetingLink: string,
): string {
  return `Hi ${clientName},\n\nYour appointment has been confirmed:\n\n📅 Date: ${date}\n⏰ Time: ${time}\n🔗 Meeting Link: ${meetingLink}\n\nPlease join the meeting 5 minutes before the scheduled time.\n\nLooking forward to speaking with you!\n\n— Oracle Digital`;
}

export function generateReminderMessage(
  clientName: string,
  date: string,
  time: string,
): string {
  return `Hi ${clientName},\n\nJust a friendly reminder about our meeting tomorrow:\n\n📅 Date: ${date}\n⏰ Time: ${time}\n\nSee you then! 🙌\n\n— Oracle Digital`;
}
