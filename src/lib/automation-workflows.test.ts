import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getAllWorkflows,
  getWorkflowById,
  executeWorkflow,
  createFollowUpSequence,
  advanceFollowUpSequence,
  pauseFollowUpSequence,
  resumeFollowUpSequence,
  getAllFollowUpSequences,
  createAppointmentSlot,
  bookAppointment,
  cancelAppointment,
  getAppointmentSlots,
  getAvailableSlotsForDate,
  generateFollowUpSequence,
  generateBookingConfirmation,
  generateReminderMessage,
  type Workflow,
  type FollowUpStep,
} from './automation-workflows';

// ═══════════════════════════════════════
// Mock localStorage
// ═══════════════════════════════════════

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ═══════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════

function makeWorkflow(overrides: Partial<Workflow> = {}): Omit<Workflow, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test Workflow',
    description: 'A test workflow',
    trigger: 'manual',
    steps: [],
    status: 'active',
    ...overrides,
  };
}

// ═══════════════════════════════════════
// Workflow Management Tests
// ═══════════════════════════════════════

describe('Workflow Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createWorkflow', () => {
    it('creates a workflow with correct fields', () => {
      const workflow = createWorkflow(makeWorkflow());
      expect(workflow).toHaveProperty('id');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.executionCount).toBe(0);
      expect(workflow.status).toBe('active');
    });
  });

  describe('getAllWorkflows', () => {
    it('returns empty array when no workflows', () => {
      expect(getAllWorkflows()).toEqual([]);
    });

    it('returns all workflows', () => {
      createWorkflow(makeWorkflow({ name: 'Workflow 1' }));
      createWorkflow(makeWorkflow({ name: 'Workflow 2' }));
      expect(getAllWorkflows()).toHaveLength(2);
    });
  });

  describe('getWorkflowById', () => {
    it('returns workflow by ID', () => {
      const workflow = createWorkflow(makeWorkflow());
      const found = getWorkflowById(workflow.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(workflow.id);
    });

    it('returns undefined for non-existent ID', () => {
      expect(getWorkflowById('non-existent')).toBeUndefined();
    });
  });

  describe('updateWorkflow', () => {
    it('updates workflow fields', () => {
      const workflow = createWorkflow(makeWorkflow());
      const updated = updateWorkflow(workflow.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');
    });

    it('returns null for non-existent ID', () => {
      expect(updateWorkflow('non-existent', { name: 'Test' })).toBeNull();
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes a workflow', () => {
      const workflow = createWorkflow(makeWorkflow());
      expect(deleteWorkflow(workflow.id)).toBe(true);
      expect(getWorkflowById(workflow.id)).toBeUndefined();
    });

    it('returns false for non-existent ID', () => {
      expect(deleteWorkflow('non-existent')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════
// Workflow Execution Tests
// ═══════════════════════════════════════

describe('Workflow Execution', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('executeWorkflow', () => {
    it('returns null for non-existent workflow', async () => {
      const result = await executeWorkflow('non-existent', {});
      expect(result).toBeNull();
    });

    it('returns null for inactive workflow', async () => {
      const workflow = createWorkflow(makeWorkflow({ status: 'paused' }));
      const result = await executeWorkflow(workflow.id, {});
      expect(result).toBeNull();
    });

    it('executes active workflow with steps', async () => {
      const workflow = createWorkflow(makeWorkflow({
        steps: [
          { id: 'step1', name: 'Step 1', action: 'send-email', config: {} },
        ],
      }));
      const result = await executeWorkflow(workflow.id, { test: true });
      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
    });
  });
});

// ═══════════════════════════════════════
// Follow-Up Sequence Tests
// ═══════════════════════════════════════

describe('Follow-Up Sequences', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createFollowUpSequence', () => {
    it('creates a sequence with correct fields', () => {
      const sequence = createFollowUpSequence({
        name: 'Test Sequence',
        leadId: 'lead-1',
        steps: [],
        status: 'active',
      });
      expect(sequence).toHaveProperty('id');
      expect(sequence.currentStep).toBe(0);
      expect(sequence.status).toBe('active');
    });
  });

  describe('advanceFollowUpSequence', () => {
    it('advances to next step', () => {
      const sequence = createFollowUpSequence({
        name: 'Test',
        leadId: 'lead-1',
        steps: [
          { day: 0, channel: 'email', template: 'Test', status: 'pending' },
          { day: 3, channel: 'email', template: 'Test 2', status: 'pending' },
        ],
        status: 'active',
      });
      const advanced = advanceFollowUpSequence(sequence.id);
      expect(advanced?.currentStep).toBe(1);
    });

    it('marks sequence as complete when all steps done', () => {
      const sequence = createFollowUpSequence({
        name: 'Test',
        leadId: 'lead-1',
        steps: [
          { day: 0, channel: 'email', template: 'Test', status: 'pending' },
        ],
        status: 'active',
      });
      const advanced = advanceFollowUpSequence(sequence.id);
      expect(advanced?.status).toBe('completed');
    });
  });

  describe('pauseFollowUpSequence', () => {
    it('pauses an active sequence', () => {
      const sequence = createFollowUpSequence({
        name: 'Test',
        leadId: 'lead-1',
        steps: [],
        status: 'active',
      });
      expect(pauseFollowUpSequence(sequence.id)).toBe(true);
      const paused = getAllFollowUpSequences().find(s => s.id === sequence.id);
      expect(paused?.status).toBe('paused');
    });
  });

  describe('resumeFollowUpSequence', () => {
    it('resumes a paused sequence', () => {
      const sequence = createFollowUpSequence({
        name: 'Test',
        leadId: 'lead-1',
        steps: [],
        status: 'paused',
      });
      expect(resumeFollowUpSequence(sequence.id)).toBe(true);
      const resumed = getAllFollowUpSequences().find(s => s.id === sequence.id);
      expect(resumed?.status).toBe('active');
    });
  });
});

// ═══════════════════════════════════════
// Appointment Booking Tests
// ═══════════════════════════════════════

describe('Appointment Booking', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createAppointmentSlot', () => {
    it('creates an available slot', () => {
      const slot = createAppointmentSlot({
        date: '2025-01-15',
        time: '10:00',
        duration: 30,
      });
      expect(slot).toHaveProperty('id');
      expect(slot.available).toBe(true);
      expect(slot.date).toBe('2025-01-15');
    });
  });

  describe('bookAppointment', () => {
    it('books an available slot', () => {
      const slot = createAppointmentSlot({
        date: '2025-01-15',
        time: '10:00',
        duration: 30,
      });
      const booked = bookAppointment(slot.id, 'client-1');
      expect(booked?.available).toBe(false);
      expect(booked?.bookedBy).toBe('client-1');
    });

    it('returns null for unavailable slot', () => {
      const slot = createAppointmentSlot({
        date: '2025-01-15',
        time: '10:00',
        duration: 30,
      });
      bookAppointment(slot.id, 'client-1');
      const result = bookAppointment(slot.id, 'client-2');
      expect(result).toBeNull();
    });
  });

  describe('cancelAppointment', () => {
    it('cancels a booked slot', () => {
      const slot = createAppointmentSlot({
        date: '2025-01-15',
        time: '10:00',
        duration: 30,
      });
      bookAppointment(slot.id, 'client-1');
      expect(cancelAppointment(slot.id)).toBe(true);
      const cancelled = getAppointmentSlots().find(s => s.id === slot.id);
      expect(cancelled?.available).toBe(true);
    });
  });

  describe('getAvailableSlotsForDate', () => {
    it('returns only available slots for date', () => {
      const slot1 = createAppointmentSlot({ date: '2025-01-15', time: '10:00', duration: 30 });
      const slot2 = createAppointmentSlot({ date: '2025-01-15', time: '11:00', duration: 30 });
      createAppointmentSlot({ date: '2025-01-16', time: '10:00', duration: 30 });

      bookAppointment(slot1.id, 'client-1');

      const available = getAvailableSlotsForDate('2025-01-15');
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe(slot2.id);
    });
  });
});

// ═══════════════════════════════════════
// Template Helpers Tests
// ═══════════════════════════════════════

describe('Template Helpers', () => {
  describe('generateFollowUpSequence', () => {
    it('generates 5 follow-up steps', () => {
      const steps = generateFollowUpSequence('John', 'Acme Corp', 'SEO');
      expect(steps).toHaveLength(5);
    });

    it('includes email and whatsapp channels', () => {
      const steps = generateFollowUpSequence('John', 'Acme Corp', 'SEO');
      const channels = steps.map(s => s.channel);
      expect(channels).toContain('email');
      expect(channels).toContain('whatsapp');
    });

    it('personalizes with lead name and company', () => {
      const steps = generateFollowUpSequence('John', 'Acme Corp', 'SEO');
      expect(steps[0].template).toContain('John');
      expect(steps[0].template).toContain('Acme Corp');
    });
  });

  describe('generateBookingConfirmation', () => {
    it('includes date, time, and meeting link', () => {
      const msg = generateBookingConfirmation('John', '2025-01-15', '10:00', 'https://meet.example.com');
      expect(msg).toContain('John');
      expect(msg).toContain('2025-01-15');
      expect(msg).toContain('10:00');
      expect(msg).toContain('https://meet.example.com');
    });
  });

  describe('generateReminderMessage', () => {
    it('includes client name and date', () => {
      const msg = generateReminderMessage('John', '2025-01-15', '10:00');
      expect(msg).toContain('John');
      expect(msg).toContain('2025-01-15');
    });
  });
});
