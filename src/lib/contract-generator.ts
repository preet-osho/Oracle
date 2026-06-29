// ═══════════════════════════════════════
// ORACLE — Contract Generator (India)
// Generate Indian-law compliant contract templates
// ═══════════════════════════════════════

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: ContractSection[];
}

export interface ContractSection {
  heading: string;
  content: string;
}

export interface ContractDetails {
  clientName: string;
  clientAddress: string;
  agencyName: string;
  agencyAddress: string;
  serviceDescription: string;
  totalAmount: number;
  paymentTerms: string;
  startDate: string;
  endDate: string;
  scope: string[];
  specialClauses?: string[];
}

// ─── Pre-built Templates ──────────────

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'service-agreement',
    name: 'Digital Service Agreement',
    description: 'Standard agreement for digital marketing, web development, or IT services',
    category: 'Service',
    sections: [
      {
        heading: '1. PARTIES',
        content: `This Digital Service Agreement ("Agreement") is entered into as of {{startDate}} between:\n\n{{agencyName}}, having its registered office at {{agencyAddress}} ("Agency")\n\nAND\n\n{{clientName}}, having its registered office at {{clientAddress}} ("Client")\n\ncollectively referred to as "Parties".`,
      },
      {
        heading: '2. SCOPE OF SERVICES',
        content: `The Agency shall provide the following digital services to the Client:\n\n{{scopeList}}\n\nThe Agency shall perform these services with reasonable skill and care, in accordance with industry standards.`,
      },
      {
        heading: '3. TERM',
        content: `This Agreement shall commence on {{startDate}} and shall continue until {{endDate}}, unless terminated earlier in accordance with Clause 9.`,
      },
      {
        heading: '4. COMPENSATION',
        content: `4.1 The Client shall pay the Agency a total fee of ₹{{totalAmount}} (Indian Rupees {{amountInWords}}) plus applicable GST.\n\n4.2 Payment shall be made as follows:\n{{paymentTerms}}\n\n4.3 Late payments shall attract interest at 1.5% per month from the due date.`,
      },
      {
        heading: '5. INTELLECTUAL PROPERTY',
        content: `5.1 All deliverables created under this Agreement shall become the property of the Client upon full payment.\n\n5.2 The Agency retains the right to use general knowledge, skills, and pre-existing IP in its work for other clients.\n\n5.3 The Client grants the Agency a non-exclusive license to use client logos and materials for portfolio and marketing purposes, unless otherwise agreed.`,
      },
      {
        heading: '6. CONFIDENTIALITY',
        content: `6.1 Both Parties agree to keep confidential all proprietary information disclosed during the term of this Agreement.\n\n6.2 This obligation survives the termination of this Agreement for a period of 2 (two) years.\n\n6.3 Exceptions: information that is publicly available, already known, or independently developed.`,
      },
      {
        heading: '7. WARRANTIES',
        content: `7.1 The Agency warrants that services will be performed in a professional and workmanlike manner.\n\n7.2 The Client warrants that it has the authority to enter into this Agreement and will provide timely access to necessary resources.`,
      },
      {
        heading: '8. LIMITATION OF LIABILITY',
        content: `8.1 The Agency's total liability under this Agreement shall not exceed the total fees paid by the Client.\n\n8.2 Neither Party shall be liable for indirect, incidental, or consequential damages.\n\n8.3 Force Majeure: Neither Party shall be liable for delays caused by circumstances beyond reasonable control.`,
      },
      {
        heading: '9. TERMINATION',
        content: `9.1 Either Party may terminate this Agreement with 30 days written notice.\n\n9.2 The Agency may terminate immediately if the Client fails to make payment within 15 days of the due date.\n\n9.3 Upon termination, the Client shall pay for all services rendered up to the date of termination.`,
      },
      {
        heading: '10. DISPUTE RESOLUTION',
        content: `10.1 Any dispute arising out of this Agreement shall first be resolved through good-faith negotiation.\n\n10.2 If unresolved within 30 days, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.\n\n10.3 The seat of arbitration shall be {{city}}, India. The language shall be English.\n\n10.4 This Agreement shall be governed by the laws of India.`,
      },
      {
        heading: '11. GENERAL PROVISIONS',
        content: `11.1 Entire Agreement: This document constitutes the entire agreement between the Parties.\n\n11.2 Amendments: Any amendments must be in writing and signed by both Parties.\n\n11.3 Severability: If any provision is found unenforceable, the remaining provisions shall continue in effect.\n\n11.4 Notices: All notices shall be in writing and sent to the addresses specified above.`,
      },
    ],
  },
  {
    id: 'retainer-agreement',
    name: 'Monthly Retainer Agreement',
    description: 'For ongoing monthly retainer services (social media, SEO, content)',
    category: 'Retainer',
    sections: [
      {
        heading: '1. PARTIES & TERM',
        content: `This Retainer Agreement is entered into on {{startDate}} between {{agencyName}} ("Agency") and {{clientName}} ("Client").\n\nTerm: Month-to-month, commencing {{startDate}}, renewable automatically unless either Party provides 30 days written notice.`,
      },
      {
        heading: '2. RETAINER SCOPE',
        content: `The Agency provides the following services on a monthly retainer basis:\n\n{{scopeList}}\n\nMonthly retainer: ₹{{totalAmount}} + 18% GST.`,
      },
      {
        heading: '3. MONTHLY DELIVERABLES',
        content: `The Agency shall deliver the following each month:\n- Monthly performance report by the 5th of the following month\n- Content calendar for the upcoming month by the 25th\n- Strategy review call (30 minutes) once per month\n- Response to client queries within 24 business hours`,
      },
      {
        heading: '4. WORKING HOURS & OVERAGES',
        content: `4.1 The retainer covers up to {{hours}} hours of work per month.\n\n4.2 Hours exceeding the retainer will be billed at ₹{{hourlyRate}}/hour + GST.\n\n4.3 Unused hours do not roll over to the next month.`,
      },
      {
        heading: '5. PAYMENT TERMS',
        content: `5.1 Monthly retainer is due on the 1st of each month, in advance.\n\n5.2 Payment via bank transfer or UPI to the Agency's designated account.\n\n5.3 Overages are billed at month-end, payable within 7 days.`,
      },
      {
        heading: '6. CONFIDENTIALITY & IP',
        content: `6.1 Both Parties maintain strict confidentiality of proprietary information.\n\n6.2 All content created during the retainer becomes property of the Client upon payment.\n\n6.3 The Agency may showcase work in its portfolio with prior written consent.`,
      },
      {
        heading: '7. TERMINATION',
        content: `7.1 Either Party may terminate with 30 days written notice.\n\n7.2 Early termination within the first 3 months requires payment of one month's retainer as a cancellation fee.\n\n7.3 All outstanding payments become due immediately upon termination.`,
      },
    ],
  },
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Mutual NDA for protecting confidential information',
    category: 'NDA',
    sections: [
      {
        heading: '1. DEFINITION OF CONFIDENTIAL INFORMATION',
        content: `"Confidential Information" means any data or information, oral or written, disclosed by either Party to the other, including but not limited to: business plans, client lists, pricing, trade secrets, technical data, marketing strategies, and financial information.`,
      },
      {
        heading: '2. OBLIGATIONS',
        content: `2.1 The receiving Party shall not disclose Confidential Information to any third party without prior written consent.\n\n2.2 The receiving Party shall use the Confidential Information solely for the purpose of evaluating or performing under the potential or actual business relationship.\n\n2.3 Both Parties shall take reasonable measures to protect the confidentiality of the other Party's information.`,
      },
      {
        heading: '3. EXCLUSIONS',
        content: `Confidential Information does not include information that:\n(a) is or becomes publicly available through no fault of the receiving Party\n(b) was already known to the receiving Party prior to disclosure\n(c) is independently developed without use of Confidential Information\n(d) is required to be disclosed by law or court order`,
      },
      {
        heading: '4. TERM & SURVIVAL',
        content: `This NDA shall be effective from {{startDate}} and shall survive for 2 (two) years from the date of last disclosure. obligations of confidentiality shall survive termination.`,
      },
      {
        heading: '5. REMEDIES',
        content: `Any breach of this NDA may cause irreparable harm. The disclosing Party shall be entitled to seek injunctive relief in addition to any other remedies available at law.\n\nThis Agreement is governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in {{city}}, India.`,
      },
    ],
  },
  {
    id: 'project-sow',
    name: 'Statement of Work (SOW)',
    description: 'Detailed project-specific scope of work document',
    category: 'SOW',
    sections: [
      {
        heading: '1. PROJECT OVERVIEW',
        content: `Project: {{serviceDescription}}\nClient: {{clientName}}\nAgency: {{agencyName}}\nStart Date: {{startDate}}\nTarget Completion: {{endDate}}`,
      },
      {
        heading: '2. DELIVERABLES',
        content: `The Agency shall deliver the following:\n\n{{scopeList}}\n\nEach deliverable will be submitted for Client review. The Client shall provide feedback within 5 business days of each submission.`,
      },
      {
        heading: '3. MILESTONES & PAYMENTS',
        content: `Payment Schedule:\n{{paymentTerms}}\n\nPayments are tied to milestone completion and Client approval. GST will be charged additionally at 18%.`,
      },
      {
        heading: '4. CLIENT RESPONSIBILITIES',
        content: `The Client agrees to:\n- Provide timely feedback (within 5 business days)\n- Supply necessary brand assets, content, and access\n- Designate a single point of contact for approvals\n- Ensure timely payment as per the payment schedule`,
      },
      {
        heading: '5. CHANGE MANAGEMENT',
        content: `5.1 Any changes to the scope must be submitted as a formal Change Request.\n\n5.2 The Agency will provide a revised estimate within 3 business days of receiving a Change Request.\n\n5.3 No work on changed scope will begin until the Change Request is approved in writing.`,
      },
      {
        heading: '6. ACCEPTANCE',
        content: `6.1 Each deliverable will be reviewed by the Client within 5 business days.\n\n6.2 If no feedback is provided within 5 business days, the deliverable is deemed accepted.\n\n6.3 Maximum 2 rounds of revisions are included per deliverable. Additional revisions will be billed separately.`,
      },
    ],
  },
];

/**
 * Generate a complete contract from a template and details
 */
export function generateContract(
  templateId: string,
  details: ContractDetails
): string {
  const template = CONTRACT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return 'Template not found.';

  const amountInWords = numberToWords(details.totalAmount);
  const scopeList = details.scope.map((s, i) => `${i + 1}. ${s}`).join('\n');

  let contract = `═══════════════════════════════════════\n`;
  contract += `${template.name.toUpperCase()}\n`;
  contract += `═══════════════════════════════════════\n\n`;
  contract += `Date: ${details.startDate}\n`;
  contract += `Between: ${details.agencyName} and ${details.clientName}\n\n`;

  for (const section of template.sections) {
    const content = section.content
      .replace(/\{\{startDate\}\}/g, details.startDate)
      .replace(/\{\{endDate\}\}/g, details.endDate)
      .replace(/\{\{clientName\}\}/g, details.clientName)
      .replace(/\{\{clientAddress\}\}/g, details.clientAddress)
      .replace(/\{\{agencyName\}\}/g, details.agencyName)
      .replace(/\{\{agencyAddress\}\}/g, details.agencyAddress)
      .replace(/\{\{serviceDescription\}\}/g, details.serviceDescription)
      .replace(/\{\{totalAmount\}\}/g, details.totalAmount.toLocaleString('en-IN'))
      .replace(/\{\{amountInWords\}\}/g, amountInWords)
      .replace(/\{\{paymentTerms\}\}/g, details.paymentTerms)
      .replace(/\{\{scopeList\}\}/g, scopeList)
      .replace(/\{\{city\}\}/g, details.agencyAddress.split(',').pop()?.trim() || 'Mumbai');

    contract += `${section.heading}\n\n${content}\n\n`;
  }

  if (details.specialClauses && details.specialClauses.length > 0) {
    contract += `ADDITIONAL CLAUSES\n\n`;
    details.specialClauses.forEach((clause, i) => {
      contract += `${template.sections.length + i + 1}. ${clause}\n\n`;
    });
  }

  contract += `\n═══════════════════════════════════════\n`;
  contract += `SIGNATURES\n\n`;
  contract += `For ${details.agencyName}:\n\n_________________________\nName:\nDate:\n\n`;
  contract += `For ${details.clientName}:\n\n_________________________\nName:\nDate:\n`;
  contract += `═══════════════════════════════════════\n`;

  return contract;
}

/**
 * Simple number to words (Indian system, abbreviated)
 */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  return convert(Math.round(num));
}
