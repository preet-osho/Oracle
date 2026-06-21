import { describe, it, expect, vi } from 'vitest';
import { generateContract } from './contracts';
import type { ContractData } from './contracts';

// ─── Helpers ───

const sampleData: ContractData = {
  agencyName: 'Oracle Agency',
  agencyAddress: '123 MG Road\nMumbai 400001',
  agencyGST: '27AABCU9603R1ZM',
  clientName: 'Acme Corp',
  clientAddress: '456 Park Street\nKolkata 700016',
  clientGST: '19AABCA1234N1ZP',
  projectDescription: 'Build a responsive website with CMS',
  startDate: '10 Jun 2026',
  endDate: '10 Sep 2026',
  totalValue: 150000,
  advanceAmount: 45000,
  finalAmount: 105000,
  paymentDueDate: '10 Jul 2026',
  jurisdiction: 'Mumbai',
};

// ─── Tests ─────────────────────────────

describe('generateContract', () => {
  it('generates website contract', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Website Development Agreement');
    expect(contract).toContain('Oracle Agency');
    expect(contract).toContain('Acme Corp');
    expect(contract).toContain('123 MG Road');
    expect(contract).toContain('Build a responsive website with CMS');
    expect(contract).toContain('₹1,50,000');
    expect(contract).toContain('₹45,000');
    expect(contract).toContain('₹1,05,000');
    expect(contract).toContain('27AABCU9603R1ZM');
    expect(contract).toContain('19AABCA1234N1ZP');
  });

  it('generates retainer contract', () => {
    const contract = generateContract('retainer', sampleData);
    expect(contract).toContain('Monthly Retainer Agreement');
    expect(contract).toContain('Oracle Agency');
    expect(contract).toContain('Monthly Retainer');
    expect(contract).toContain('₹1,50,000/month');
  });

  it('generates SEO contract', () => {
    const contract = generateContract('seo', sampleData);
    expect(contract).toContain('SEO Services Agreement');
    expect(contract).toContain('Oracle Agency');
    expect(contract).toContain('SEO Services');
    expect(contract).toContain('₹1,50,000/month');
  });

  it('generates social media contract', () => {
    const contract = generateContract('social_media', sampleData);
    expect(contract).toContain('Social Media Marketing Agreement');
    expect(contract).toContain('Oracle Agency');
    expect(contract).toContain('Social Media');
    expect(contract).toContain('₹1,50,000/month');
  });

  it('generates NDA contract', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('Non-Disclosure Agreement');
    expect(contract).toContain('Party A');
    expect(contract).toContain('Party B');
    expect(contract).toContain('Confidential Information');
  });

  it('defaults to website contract for unknown type', () => {
    const contract = generateContract('unknown' as never, sampleData);
    expect(contract).toContain('Website Development Agreement');
  });
});

describe('common clauses', () => {
  it('includes force majeure clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Force Majeure');
    expect(contract).toContain('Neither party shall be liable');
  });

  it('includes governing law clause with jurisdiction', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Governing Law');
    expect(contract).toContain('Mumbai');
  });

  it('includes entire agreement clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Entire Agreement');
  });

  it('includes severability clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Severability');
  });

  it('includes signature blocks', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('AGREED AND ACCEPTED');
    expect(contract).toContain('Oracle Agency');
    expect(contract).toContain('Acme Corp');
    expect(contract).toContain('Signature: _______________________');
  });
});

describe('standard clauses', () => {
  it('includes intellectual property clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Intellectual Property');
    expect(contract).toContain('Oracle Agency');
  });

  it('includes confidentiality clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Confidentiality');
    expect(contract).toContain('2 (two) years');
  });

  it('includes revision policy', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Revision Policy');
    expect(contract).toContain('₹1,500 per hour');
  });

  it('includes termination clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Termination');
    expect(contract).toContain('30 days');
  });
});

describe('GST handling', () => {
  it('includes agency GST when provided', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('GSTIN: 27AABCU9603R1ZM');
  });

  it('includes client GST when provided', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('GSTIN: 19AABCA1234N1ZP');
  });

  it('omits agency GST when not provided', () => {
    const data = { ...sampleData, agencyGST: undefined };
    const contract = generateContract('website', data);
    expect(contract).not.toContain('GSTIN: 27AABCU9603R1ZM');
  });

  it('omits client GST when not provided', () => {
    const data = { ...sampleData, clientGST: undefined };
    const contract = generateContract('website', data);
    expect(contract).not.toContain('GSTIN: 19AABCA1234N1ZP');
  });
});

describe('jurisdiction handling', () => {
  it('uses provided jurisdiction', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('courts of Mumbai');
  });

  it('uses default jurisdiction when not provided', () => {
    const data = { ...sampleData, jurisdiction: '' };
    const contract = generateContract('website', data);
    expect(contract).toContain('courts of competent jurisdiction');
  });
});

describe('NDA specific', () => {
  it('includes purpose from project description', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('Build a responsive website with CMS');
  });

  it('includes return of materials clause', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('Return of Materials');
  });

  it('includes remedies clause', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('Remedies');
    expect(contract).toContain('injunctive relief');
  });

  it('includes exclusions clause', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('Exclusions');
    expect(contract).toContain('publicly available');
  });

  it('includes term and obligations', () => {
    const contract = generateContract('nda', sampleData);
    expect(contract).toContain('2 (two) years');
    expect(contract).toContain('Obligations');
    expect(contract).toContain('strict confidence');
  });

  it('uses default jurisdiction when not provided', () => {
    const data = { ...sampleData, jurisdiction: '' };
    const contract = generateContract('nda', data);
    expect(contract).toContain('courts of competent jurisdiction');
  });
});

// ─── Per-Contract Specific Clauses ──────

describe('website contract specifics', () => {
  it('includes scope of work with frontend, backend, SEO', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Frontend development');
    expect(contract).toContain('Backend integration');
    expect(contract).toContain('On-page SEO');
  });

  it('includes timeline section', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('Timeline');
    expect(contract).toContain('**Start Date:** 10 Jun 2026');
    expect(contract).toContain('**Expected Completion:** 10 Sep 2026');
  });

  it('handles missing endDate gracefully', () => {
    const data = { ...sampleData, endDate: undefined };
    const contract = generateContract('website', data);
    expect(contract).toContain('To be mutually agreed upon');
  });

  it('includes investment section with GST mention', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('GST at 18%');
    expect(contract).toContain('Bank transfer, UPI');
  });

  it('includes 30-day warranty', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('30-day warranty');
  });

  it('late payment interest clause', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('1.5% per month');
  });
});

describe('retainer contract specifics', () => {
  it('includes minimum commitment of 3 months', () => {
    const contract = generateContract('retainer', sampleData);
    expect(contract).toContain('Minimum Commitment');
    expect(contract).toContain('3 months');
  });

  it('includes auto-renewal clause', () => {
    const contract = generateContract('retainer', sampleData);
    expect(contract).toContain('Auto-Renewal');
  });

  it('includes hourly rate for overages', () => {
    const contract = generateContract('retainer', sampleData);
    expect(contract).toContain('₹2,000/hour');
  });

  it('includes monthly performance reporting', () => {
    const contract = generateContract('retainer', sampleData);
    expect(contract).toContain('Monthly performance reporting');
  });
});

describe('SEO contract specifics', () => {
  it('includes SEO disclaimer about rankings', () => {
    const contract = generateContract('seo', sampleData);
    expect(contract).toContain('no guarantees regarding specific search engine rankings');
    expect(contract).toContain('3-6 months');
  });

  it('includes monthly reports by 5th', () => {
    const contract = generateContract('seo', sampleData);
    expect(contract).toContain('Monthly Reports');
    expect(contract).toContain('5th of each month');
  });

  it('includes investment disclaimer', () => {
    const contract = generateContract('seo', sampleData);
    expect(contract).toContain('educational and professional purposes only');
  });

  it('includes setup fee', () => {
    const contract = generateContract('seo', sampleData);
    expect(contract).toContain('Setup Fee');
  });
});

describe('social media contract specifics', () => {
  it('includes content approval clause', () => {
    const contract = generateContract('social_media', sampleData);
    expect(contract).toContain('Content Approval');
    expect(contract).toContain('48 hours');
  });

  it('includes monthly strategy calls', () => {
    const contract = generateContract('social_media', sampleData);
    expect(contract).toContain('Monthly strategy calls');
  });

  it('includes minimum commitment of 3 months', () => {
    const contract = generateContract('social_media', sampleData);
    expect(contract).toContain('Minimum Commitment');
    expect(contract).toContain('3 months');
  });

  it('includes community management', () => {
    const contract = generateContract('social_media', sampleData);
    expect(contract).toContain('Community management');
  });
});

// ─── Revision Policy Branch ─────────────

describe('revision policy', () => {
  it('uses revisions in scope when project description contains revision', () => {
    const data = { ...sampleData, projectDescription: 'Build website with 5 revision rounds included' };
    const contract = generateContract('website', data);
    expect(contract).toContain('revisions specified in the scope');
  });

  it('uses default 3 rounds when no revision keyword', () => {
    const contract = generateContract('website', sampleData);
    expect(contract).toContain('up to 3 rounds of revisions');
  });
});

// ─── Empty / Edge Case Data ─────────────

describe('edge case data', () => {
  it('handles minimal required fields', () => {
    const data: ContractData = {
      agencyName: 'A',
      agencyAddress: 'B',
      clientName: 'C',
      clientAddress: 'D',
      projectDescription: 'X',
      startDate: '1 Jan 2026',
      totalValue: 0,
      advanceAmount: 0,
      finalAmount: 0,
      paymentDueDate: '1 Feb 2026',
      jurisdiction: 'Delhi',
    };
    const contract = generateContract('website', data);
    expect(contract).toContain('A');
    expect(contract).toContain('C');
    expect(contract).toContain('₹0');
  });

  it('handles large amounts with Indian formatting', () => {
    const data = { ...sampleData, totalValue: 10000000, advanceAmount: 2500000, finalAmount: 7500000 };
    const contract = generateContract('website', data);
    expect(contract).toContain('₹1,00,00,000');
    expect(contract).toContain('₹25,00,000');
    expect(contract).toContain('₹75,00,000');
  });

  it('all contract types include date stamp', () => {
    const types: Array<'website' | 'retainer' | 'seo' | 'social_media' | 'nda'> = ['website', 'retainer', 'seo', 'social_media', 'nda'];
    const dateStr = new Date().toLocaleDateString('en-IN');
    for (const type of types) {
      const contract = generateContract(type, sampleData);
      expect(contract).toContain(`**Date:** ${dateStr}`);
    }
  });
});

// ─── exportContractPDF ──────────────────

describe('exportContractPDF', () => {
  it('does not throw when jsPDF and html2canvas are available', async () => {
    const { exportContractPDF } = await import('./contracts');
    // In test environment, dynamic imports will fail so it falls back to text download
    const blobMock = { type: '', size: 0 };
    const createObjectURLMock = vi.fn(() => 'blob:mock');
    const revokeObjectURLMock = vi.fn();
    const clickMock = vi.fn();

    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickMock } as unknown as HTMLAnchorElement;
      }
      if (tag === 'div') {
        return {
          innerHTML: '',
          style: { cssText: '' },
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        } as unknown as HTMLDivElement;
      }
      return originalCreateElement.call(document, tag);
    }) as typeof document.createElement;

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    try {
      // This will fail the jsPDF import and fall back to text download
      await exportContractPDF('test contract content', 'test.pdf');
      // Fallback path: creates blob, creates object URL, clicks, revokes
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    } finally {
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
