import { describe, it, expect } from 'vitest';
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
});
