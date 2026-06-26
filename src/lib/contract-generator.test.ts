import { describe, it, expect } from 'vitest';
import {
  generateContract,
  CONTRACT_TEMPLATES,
  type ContractDetails,
} from './contract-generator';

const sampleDetails: ContractDetails = {
  clientName: 'Priya Sharma',
  clientAddress: '123 MG Road, Mumbai 400001',
  agencyName: 'Oracle Digital',
  agencyAddress: '456 Park Street, Delhi 110001',
  serviceDescription: 'SEO and Google Ads management',
  totalAmount: 150000,
  paymentTerms: '50% upfront, 50% on completion',
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  scope: ['SEO audit', 'Google Ads setup', 'Monthly reporting'],
};

describe('CONTRACT_TEMPLATES', () => {
  it('has 4 templates', () => {
    expect(CONTRACT_TEMPLATES.length).toBe(4);
  });

  it('has service agreement template', () => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === 'service-agreement');
    expect(template).toBeDefined();
    expect(template!.name).toBe('Digital Service Agreement');
    expect(template!.category).toBe('Service');
  });

  it('has retainer agreement template', () => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === 'retainer-agreement');
    expect(template).toBeDefined();
    expect(template!.name).toBe('Monthly Retainer Agreement');
    expect(template!.category).toBe('Retainer');
  });

  it('has NDA template', () => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === 'nda');
    expect(template).toBeDefined();
    expect(template!.name).toBe('Non-Disclosure Agreement');
    expect(template!.category).toBe('NDA');
  });

  it('has SOW template', () => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === 'project-sow');
    expect(template).toBeDefined();
    expect(template!.name).toBe('Statement of Work (SOW)');
    expect(template!.category).toBe('SOW');
  });

  it('each template has sections with headings and content', () => {
    for (const template of CONTRACT_TEMPLATES) {
      expect(template.sections.length).toBeGreaterThan(0);
      for (const section of template.sections) {
        expect(section.heading).toBeTruthy();
        expect(section.content).toBeTruthy();
      }
    }
  });
});

describe('generateContract', () => {
  it('generates a contract from service agreement template', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('DIGITAL SERVICE AGREEMENT');
    expect(contract).toContain('Oracle Digital');
    expect(contract).toContain('Priya Sharma');
    expect(contract).toContain('2026-01-01');
    expect(contract).toContain('2026-06-30');
  });

  it('replaces template variables with details', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('456 Park Street, Delhi 110001');
    expect(contract).toContain('123 MG Road, Mumbai 400001');
    expect(contract).toContain('50% upfront, 50% on completion');
  });

  it('includes scope list', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('1. SEO audit');
    expect(contract).toContain('2. Google Ads setup');
    expect(contract).toContain('3. Monthly reporting');
  });

  it('formats amount in Indian system', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('1,50,000');
  });

  it('includes amount in words', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('Lakh');
  });

  it('includes signature blocks', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('SIGNATURES');
    expect(contract).toContain('For Oracle Digital:');
    expect(contract).toContain('For Priya Sharma:');
  });

  it('returns error message for invalid template', () => {
    const contract = generateContract('nonexistent', sampleDetails);
    expect(contract).toBe('Template not found.');
  });

  it('includes special clauses when provided', () => {
    const detailsWithClauses: ContractDetails = {
      ...sampleDetails,
      specialClauses: ['No competitive work clause', 'Extended warranty period'],
    };
    const contract = generateContract('service-agreement', detailsWithClauses);
    expect(contract).toContain('ADDITIONAL CLAUSES');
    expect(contract).toContain('No competitive work clause');
    expect(contract).toContain('Extended warranty period');
  });

  it('generates retainer contract', () => {
    const contract = generateContract('retainer-agreement', sampleDetails);
    expect(contract).toContain('RETAINER');
    expect(contract).toContain('Oracle Digital');
    expect(contract).toContain('Priya Sharma');
  });

  it('generates NDA contract', () => {
    const contract = generateContract('nda', sampleDetails);
    expect(contract).toContain('NON-DISCLOSURE');
    expect(contract).toContain('Confidential Information');
  });

  it('generates SOW contract', () => {
    const contract = generateContract('project-sow', sampleDetails);
    expect(contract).toContain('STATEMENT OF WORK');
    expect(contract).toContain('PROJECT OVERVIEW');
  });

  it('extracts city from agency address', () => {
    const contract = generateContract('service-agreement', sampleDetails);
    expect(contract).toContain('Delhi');
  });

  it('replaces serviceDescription in SOW template', () => {
    const contract = generateContract('project-sow', sampleDetails);
    expect(contract).toContain('SEO and Google Ads management');
  });

  it('handles zero amount', () => {
    const details: ContractDetails = { ...sampleDetails, totalAmount: 0 };
    const contract = generateContract('service-agreement', details);
    expect(contract).toContain('0');
  });

  it('handles large amounts', () => {
    const details: ContractDetails = { ...sampleDetails, totalAmount: 10000000 };
    const contract = generateContract('service-agreement', details);
    expect(contract).toContain('1,00,00,000');
    expect(contract).toContain('Crore');
  });
});
