// ═══════════════════════════════════════
// ORACLE — Automation Schedules API
// GET  /api/automation/schedules — list schedules for current org
// POST /api/automation/schedules — create or update a schedule
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { hasPermissionSync } from '@/lib/permissions';
import {
  SCHEDULE_DEFINITIONS,
  createDefaultSchedule,
  isValidCron,
  type ScheduleType,
} from '@/lib/automation/scheduler';
import { createLogger } from '@/lib/logger';

const log = createLogger('AutomationSchedules');

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  try {
    const { supabase } = auth;

    const { data, error } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('type');

    if (error) {
      log.error('Failed to list schedules', { error: error.message, orgId: auth.org.orgId });
      return NextResponse.json({ schedules: [], available: Object.values(SCHEDULE_DEFINITIONS) });
    }

    return NextResponse.json({
      schedules: data ?? [],
      available: Object.values(SCHEDULE_DEFINITIONS),
    });
  } catch (err) {
    log.error('Failed to list schedules', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ schedules: [], available: Object.values(SCHEDULE_DEFINITIONS) });
  }
}

export async function POST(request: Request) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  // Only admins can manage schedules
  const perm = hasPermissionSync(auth.org.role, 'MANAGE_SETTINGS');
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason }, { status: 403 });
  }

  try {
    const { type, frequency, cronExpression, enabled, config } = await request.json();

    // Validate schedule type
    if (!type || !SCHEDULE_DEFINITIONS[type as ScheduleType]) {
      return NextResponse.json(
        { error: `Invalid schedule type. Valid types: ${Object.keys(SCHEDULE_DEFINITIONS).join(', ')}` },
        { status: 400 }
      );
    }

    const scheduleType = type as ScheduleType;
    const def = SCHEDULE_DEFINITIONS[scheduleType];

    // Validate frequency
    const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly'];
    const finalFrequency = frequency || def.defaultFrequency;
    if (!validFrequencies.includes(finalFrequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Valid: ${validFrequencies.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate cron expression
    const finalCron = cronExpression || def.cronExpression;
    if (!isValidCron(finalCron)) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Expected 5-field format: minute hour day month weekday' },
        { status: 400 }
      );
    }

    const scheduleData = createDefaultSchedule(scheduleType, auth.org.orgId, {
      frequency: finalFrequency,
      cronExpression: finalCron,
      enabled: enabled ?? def.enabledByDefault,
      config: config ?? {},
    });

    // Upsert: check if schedule of this type already exists for this org
    const { supabase } = auth;
    const { data: existing } = await supabase
      .from('automation_schedules')
      .select('id')
      .eq('org_id', auth.org.orgId)
      .eq('type', scheduleType)
      .single();

    if (existing) {
      // Update existing schedule
      const { error } = await supabase
        .from('automation_schedules')
        .update({
          frequency: scheduleData.frequency,
          cron_expression: scheduleData.cronExpression,
          enabled: scheduleData.enabled,
          config: scheduleData.config,
          next_run_at: scheduleData.nextRunAt,
          updated_at: Date.now(),
        })
        .eq('id', existing.id);

      if (error) {
        log.error('Failed to update schedule', { error: error.message });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      log.info('Schedule updated', { scheduleId: existing.id, type: scheduleType });
      return NextResponse.json({ success: true, scheduleId: existing.id, action: 'updated' });
    }

    // Create new schedule
    const { data: newSchedule, error } = await supabase
      .from('automation_schedules')
      .insert({
        org_id: auth.org.orgId,
        type: scheduleType,
        frequency: scheduleData.frequency,
        cron_expression: scheduleData.cronExpression,
        enabled: scheduleData.enabled,
        config: scheduleData.config,
        next_run_at: scheduleData.nextRunAt,
        created_at: Date.now(),
        updated_at: Date.now(),
      })
      .select('id')
      .single();

    if (error) {
      log.error('Failed to create schedule', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    log.info('Schedule created', { scheduleId: newSchedule.id, type: scheduleType });

    return NextResponse.json(
      { success: true, scheduleId: newSchedule.id, action: 'created' },
      { status: 201 }
    );
  } catch (err) {
    log.error('Failed to create/update schedule', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ error: 'Failed to manage schedule' }, { status: 500 });
  }
}
