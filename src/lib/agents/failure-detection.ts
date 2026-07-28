// ═══════════════════════════════════════
// ORACLE — Failure Detection & Auto-Recovery
// Detects hallucinations, broken logic, missing data, and triggers recovery
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';

const log = createLogger('FailureDetection');

// ─── Types ─────────────────────────────

export type FailureType =
  | 'hallucination'
  | 'broken_logic'
  | 'missing_data'
  | 'tool_failure'
  | 'bad_assumption'
  | 'poor_seo'
  | 'weak_offer'
  | 'weak_outreach'
  | 'bad_targeting'
  | 'conversion_leak'
  | 'inconsistent_data'
  | 'outdated_info'
  | 'fabricated_source'
  | 'overconfident_statement';

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureDetection {
  id: string;
  type: FailureType;
  severity: FailureSeverity;
  description: string;
  location: string;
  evidence: string;
  suggestion: string;
  autoFixable: boolean;
  detectedAt: number;
}

export interface RecoveryAction {
  id: string;
  failureId: string;
  action: 'retry' | 'fix' | 'fallback' | 'escalate' | 'skip';
  description: string;
  result?: string;
  success: boolean;
  executedAt: number;
}

export interface FailureReport {
  id: string;
  agentId: string;
  taskDescription: string;
  failures: FailureDetection[];
  recoveryActions: RecoveryAction[];
  overallSeverity: FailureSeverity;
  resolved: boolean;
  timestamp: number;
}

// ─── Failure Detection Store ──────────

const failureReports: Map<string, FailureReport> = new Map();

// ─── Failure Detection Engine ─────────

export class FailureDetectionEngine {
  private hallucinationPatterns: RegExp[] = [
    /according to (?:a )?study (?:from|by) (?!202[0-9])\d{4}/i,
    /research (?:shows|proves|confirms) that/i,
    /statistics (?:show|indicate|reveal) that/i,
    /experts (?:agree|say|believe) that/i,
    /studies (?:have )?(?:shown|proven|demonstrated)/i,
  ];

  private vagueQuantificationPatterns: RegExp[] = [
    /many (?:people|companies|businesses)/i,
    /significant (?:increase|decrease|improvement)/i,
    /substantial (?:growth|improvement|reduction)/i,
    /considerable (?:impact|benefit|result)/i,
    /a lot of/i,
    /very (?:good|bad|effective|important)/i,
  ];

  private overconfidentPatterns: RegExp[] = [
    /guaranteed (?:to|results?)/i,
    /100% (?:success|effective|proven)/i,
    /always (?:works|succeeds|delivers)/i,
    /never (?:fails|disappoints)/i,
    /will definitely/i,
    /without (?:any )?doubt/i,
  ];

  /**
   * Detect failures in agent output
   */
  detectFailures(output: string, agentId: string, taskDescription: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Detect hallucinations
    failures.push(...this.detectHallucinations(output));

    // Detect vague quantification
    failures.push(...this.detectVagueQuantification(output));

    // Detect overconfident statements
    failures.push(...this.detectOverconfidentStatements(output));

    // Detect inconsistencies
    failures.push(...this.detectInconsistencies(output));

    // Detect missing proof/evidence
    failures.push(...this.detectMissingProof(output));

    // Detect poor targeting (for outreach content)
    if (taskDescription.toLowerCase().includes('outreach') ||
        taskDescription.toLowerCase().includes('cold email')) {
      failures.push(...this.detectWeakOutreach(output));
    }

    // Detect weak offers
    if (taskDescription.toLowerCase().includes('offer') ||
        taskDescription.toLowerCase().includes('proposal')) {
      failures.push(...this.detectWeakOffer(output));
    }

    // Detect poor SEO practices
    if (taskDescription.toLowerCase().includes('seo') ||
        taskDescription.toLowerCase().includes('content')) {
      failures.push(...this.detectPoorSEO(output));
    }

    // Detect conversion leaks
    failures.push(...this.detectConversionLeaks(output));

    // Log detection results
    log.info('Failure detection completed', {
      agentId,
      failureCount: failures.length,
      severityBreakdown: this.getSeverityBreakdown(failures),
    });

    return failures;
  }

  /**
   * Generate a failure report
   */
  generateReport(
    agentId: string,
    taskDescription: string,
    failures: FailureDetection[],
  ): FailureReport {
    const recoveryActions = failures.map((f) => this.generateRecoveryAction(f));

    const overallSeverity = this.calculateOverallSeverity(failures);

    const report: FailureReport = {
      id: `fail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      taskDescription,
      failures,
      recoveryActions,
      overallSeverity,
      resolved: false,
      timestamp: Date.now(),
    };

    failureReports.set(report.id, report);

    log.info('Failure report generated', {
      id: report.id,
      failureCount: failures.length,
      overallSeverity,
    });

    return report;
  }

  /**
   * Get failure history for an agent
   */
  getAgentFailureHistory(agentId: string, limit: number = 50): FailureReport[] {
    return Array.from(failureReports.values())
      .filter((r) => r.agentId === agentId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get failure statistics
   */
  getFailureStats(agentId?: string): {
    totalFailures: number;
    byType: Record<FailureType, number>;
    bySeverity: Record<FailureSeverity, number>;
    autoFixRate: number;
    resolutionRate: number;
  } {
    const reports = agentId
      ? this.getAgentFailureHistory(agentId, 1000)
      : Array.from(failureReports.values());

    const byType = {} as Record<FailureType, number>;
    const bySeverity = {} as Record<FailureSeverity, number>;
    let autoFixableCount = 0;
    let resolvedCount = 0;

    for (const report of reports) {
      for (const failure of report.failures) {
        byType[failure.type] = (byType[failure.type] || 0) + 1;
        bySeverity[failure.severity] = (bySeverity[failure.severity] || 0) + 1;
        if (failure.autoFixable) autoFixableCount++;
      }
      if (report.resolved) resolvedCount++;
    }

    const totalFailures = reports.reduce((sum, r) => sum + r.failures.length, 0);

    return {
      totalFailures,
      byType,
      bySeverity,
      autoFixRate: totalFailures > 0 ? (autoFixableCount / totalFailures) * 100 : 0,
      resolutionRate: reports.length > 0 ? (resolvedCount / reports.length) * 100 : 0,
    };
  }

  // ─── Detection Methods ──────────────

  private detectHallucinations(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    for (const pattern of this.hallucinationPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'hallucination',
          severity: 'high',
          description: 'Potential hallucination detected - unverifiable claim',
          location: match[0],
          evidence: `Pattern matched: "${match[0]}"`,
          suggestion: 'Add source URL or mark as assumption',
          autoFixable: false,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectVagueQuantification(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    for (const pattern of this.vagueQuantificationPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'bad_assumption',
          severity: 'medium',
          description: 'Vague quantification detected',
          location: match[0],
          evidence: `Pattern matched: "${match[0]}"`,
          suggestion: 'Replace with specific numbers or percentages',
          autoFixable: true,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectOverconfidentStatements(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    for (const pattern of this.overconfidentPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'overconfident_statement',
          severity: 'medium',
          description: 'Overconfident statement detected',
          location: match[0],
          evidence: `Pattern matched: "${match[0]}"`,
          suggestion: 'Soften language with qualifiers like "typically" or "often"',
          autoFixable: true,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectInconsistencies(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for contradictory statements
    const positivePatterns = ['increase', 'improve', 'grow', 'better', 'higher'];
    const negativePatterns = ['decrease', 'decline', 'reduce', 'worse', 'lower'];

    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        // Simple inconsistency detection (could be more sophisticated)
        if (lines[i].includes('will increase') && lines[j].includes('will decrease')) {
          failures.push({
            id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: 'inconsistent_data',
            severity: 'high',
            description: 'Potential inconsistency detected',
            location: `Lines ${i + 1} and ${j + 1}`,
            evidence: `"${lines[i].trim()}" vs "${lines[j].trim()}"`,
            suggestion: 'Review and reconcile contradictory statements',
            autoFixable: false,
            detectedAt: Date.now(),
          });
        }
      }
    }

    return failures;
  }

  private detectMissingProof(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for claims without evidence
    const claimPatterns = [
      /(?:will|can|should) (?:increase|improve|generate|deliver) (\d+)/i,
      /(?:proven|effective|successful) (?:strategy|technique|method)/i,
    ];

    for (const pattern of claimPatterns) {
      const match = output.match(pattern);
      if (match && !output.includes('source') && !output.includes('study')) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'missing_data',
          severity: 'medium',
          description: 'Claim without supporting evidence',
          location: match[0],
          evidence: `Claim: "${match[0]}"`,
          suggestion: 'Add source, case study, or mark as assumption',
          autoFixable: false,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectWeakOutreach(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for generic outreach
    const genericPatterns = [
      /dear (?:sir|madam|team)/i,
      /i hope this (?:email|message) finds you well/i,
      /we are (?:a|the) (?:leading|top|best)/i,
      /our (?:services|solutions|products) can/i,
    ];

    for (const pattern of genericPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'weak_outreach',
          severity: 'high',
          description: 'Generic outreach pattern detected',
          location: match[0],
          evidence: `Pattern: "${match[0]}"`,
          suggestion: 'Personalize with specific recipient name and business details',
          autoFixable: true,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectWeakOffer(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for weak offer framing
    const weakPatterns = [
      /(?:we|our) (?:offer|provide|deliver) (?:a |the )?(?:wide range|various|many)/i,
      /(?:best|great|excellent) (?:quality|service|results)/i,
      /(?:affordable|cheap|low cost) (?:pricing|rates)/i,
    ];

    for (const pattern of weakPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'weak_offer',
          severity: 'medium',
          description: 'Weak offer framing detected',
          location: match[0],
          evidence: `Pattern: "${match[0]}"`,
          suggestion: 'Frame as outcome-based offer with specific metrics',
          autoFixable: true,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectPoorSEO(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for poor SEO practices
    const poorSEOPatterns = [
      /keyword stuffing/i,
      /invisible text/i,
      /cloaking/i,
      /doorway pages/i,
    ];

    for (const pattern of poorSEOPatterns) {
      const match = output.match(pattern);
      if (match) {
        failures.push({
          id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'poor_seo',
          severity: 'critical',
          description: 'Poor SEO practice detected',
          location: match[0],
          evidence: `Pattern: "${match[0]}"`,
          suggestion: 'Remove black-hat SEO techniques',
          autoFixable: true,
          detectedAt: Date.now(),
        });
      }
    }

    return failures;
  }

  private detectConversionLeaks(output: string): FailureDetection[] {
    const failures: FailureDetection[] = [];

    // Check for missing CTAs
    const hasCTA = /(?:click|call|sign up|book|schedule|contact|learn more|get started)/i.test(output);
    const isLandingPage = /landing page|website|home page/i.test(output);

    if (isLandingPage && !hasCTA) {
      failures.push({
        id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'conversion_leak',
        severity: 'high',
        description: 'Missing call-to-action in conversion-focused content',
        location: 'Overall output',
        evidence: 'No CTA detected in landing page content',
        suggestion: 'Add clear, compelling call-to-action',
        autoFixable: true,
        detectedAt: Date.now(),
      });
    }

    return failures;
  }

  // ─── Helper Methods ─────────────────

  private generateRecoveryAction(failure: FailureDetection): RecoveryAction {
    let action: RecoveryAction['action'] = 'skip';
    let description = '';

    switch (failure.severity) {
      case 'critical':
        action = 'escalate';
        description = 'Escalate to human review - critical issue detected';
        break;
      case 'high':
        if (failure.autoFixable) {
          action = 'fix';
          description = `Auto-fix: ${failure.suggestion}`;
        } else {
          action = 'retry';
          description = 'Retry with modified prompt';
        }
        break;
      case 'medium':
        if (failure.autoFixable) {
          action = 'fix';
          description = `Auto-fix: ${failure.suggestion}`;
        } else {
          action = 'skip';
          description = 'Log for manual review';
        }
        break;
      case 'low':
        action = 'skip';
        description = 'Log for future improvement';
        break;
    }

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      failureId: failure.id,
      action,
      description,
      success: true,
      executedAt: Date.now(),
    };
  }

  private calculateOverallSeverity(failures: FailureDetection[]): FailureSeverity {
    if (failures.some((f) => f.severity === 'critical')) return 'critical';
    if (failures.some((f) => f.severity === 'high')) return 'high';
    if (failures.some((f) => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  private getSeverityBreakdown(failures: FailureDetection[]): Record<FailureSeverity, number> {
    const breakdown = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const f of failures) {
      breakdown[f.severity]++;
    }
    return breakdown;
  }
}

// ─── Singleton ────────────────────────

let failureDetectionInstance: FailureDetectionEngine | null = null;

export function getFailureDetectionEngine(): FailureDetectionEngine {
  if (!failureDetectionInstance) {
    failureDetectionInstance = new FailureDetectionEngine();
  }
  return failureDetectionInstance;
}

// ─── Convenience Functions ────────────

export function detectFailures(
  output: string,
  agentId: string,
  taskDescription: string,
): FailureDetection[] {
  return getFailureDetectionEngine().detectFailures(output, agentId, taskDescription);
}

export function generateFailureReport(
  agentId: string,
  taskDescription: string,
  output: string,
): FailureReport {
  const engine = getFailureDetectionEngine();
  const failures = engine.detectFailures(output, agentId, taskDescription);
  return engine.generateReport(agentId, taskDescription, failures);
}
