// ═══════════════════════════════════════
// ORACLE — Contract Templates
// 5 Indian-law-compliant templates · Professional legal language
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface ContractData {
  agencyName: string;
  agencyAddress: string;
  agencyGST?: string;
  clientName: string;
  clientAddress: string;
  clientGST?: string;
  projectDescription: string;
  startDate: string;
  endDate?: string;
  totalValue: number;
  advanceAmount: number;
  finalAmount: number;
  paymentDueDate: string;
  jurisdiction: string;
}

// ─── Generate Contract ─────────────────

export function generateContract(
  type: 'website' | 'retainer' | 'seo' | 'social_media' | 'nda',
  data: ContractData
): string {
  switch (type) {
    case 'website': return websiteContract(data);
    case 'retainer': return retainerContract(data);
    case 'seo': return seoContract(data);
    case 'social_media': return socialMediaContract(data);
    case 'nda': return ndaContract(data);
    default: return websiteContract(data);
  }
}

// ─── Common Clauses ────────────────────

function commonClauses(data: ContractData): string {
  return `
## 9. Force Majeure

Neither party shall be liable for any failure or delay in performing its obligations under this Agreement where such failure or delay results from circumstances beyond the reasonable control of that party, including but not limited to acts of God, natural disasters, pandemic, war, terrorism, riots, government actions, power failure, internet outages, or strikes. The affected party shall promptly notify the other party and take reasonable steps to mitigate the impact.

## 10. Governing Law and Dispute Resolution

This Agreement shall be governed by and construed in accordance with the laws of India. Any dispute arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts of ${data.jurisdiction || 'the courts of competent jurisdiction'}. The parties agree to first attempt to resolve any dispute through good-faith negotiation for a period of 30 days before initiating formal proceedings.

## 11. Entire Agreement

This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, representations, and understandings. No amendment to this Agreement shall be effective unless in writing and signed by both parties.

## 12. Severability

If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

---

**AGREED AND ACCEPTED:**

**For ${data.agencyName}:**

Signature: _______________________

Name: _______________________

Date: _______________________

**For ${data.clientName}:**

Signature: _______________________

Name: _______________________

Date: _______________________`;
}

function standardClauses(data: ContractData): string {
  return `
## 5. Intellectual Property

All intellectual property rights, including but not limited to copyrights, trademarks, designs, source code, content, and creative work produced under this Agreement shall transfer fully to the Client upon receipt of complete payment as specified in Section 3. Until full payment is received, all work product remains the property of ${data.agencyName}.

## 6. Confidentiality

Both parties agree to keep confidential all proprietary information, business strategies, client data, trade secrets, and financial information disclosed during the course of this engagement. This obligation shall survive the termination of this Agreement for a period of 2 (two) years.

## 7. Revision Policy

This Agreement includes ${data.projectDescription.includes('revision') ? 'the revisions specified in the scope' : 'up to 3 rounds of revisions'} as part of the scope of work. Additional revisions beyond the included scope shall be billed at ₹1,500 per hour. Revision requests must be provided in writing within 7 business days of deliverable receipt.

## 8. Termination

Either party may terminate this Agreement with 30 days' written notice. In the event of termination:
- The advance amount paid under Section 3 is non-refundable
- ${data.agencyName} shall be compensated for all work completed up to the date of termination
- All completed work product shall be delivered to the Client upon receipt of payment for completed work
- The Client shall return all confidential materials of ${data.agencyName}`;
}

// ─── Website Development Contract ──────

function websiteContract(data: ContractData): string {
  return `# Website Development Agreement

**Date:** ${new Date().toLocaleDateString('en-IN')}

This Website Development Agreement ("Agreement") is entered into between:

**Service Provider:** ${data.agencyName}, located at ${data.agencyAddress}${data.agencyGST ? `, GSTIN: ${data.agencyGST}` : ''} ("the Agency")

**Client:** ${data.clientName}, located at ${data.clientAddress}${data.clientGST ? `, GSTIN: ${data.clientGST}` : ''} ("the Client")

Collectively referred to as "the Parties."

---

## 1. Scope of Work

The Agency agrees to provide website development services as described below:

**Project Description:** ${data.projectDescription}

The scope includes but is not limited to:
- Frontend development with responsive design
- Backend integration and CMS setup
- On-page SEO optimization
- Cross-browser and device testing
- Deployment to production environment
- Post-launch bug fixes (30-day warranty)

Any changes to the scope of work must be agreed upon in writing by both Parties and may result in additional charges.

## 2. Timeline

- **Start Date:** ${data.startDate}
- **Expected Completion:** ${data.endDate || 'To be mutually agreed upon'}

The Agency shall use commercially reasonable efforts to meet the timeline. Delays caused by the Client (including delayed approvals, content delivery, or feedback) may extend the timeline proportionally.

## 3. Investment

- **Total Project Value:** ₹${data.totalValue.toLocaleString('en-IN')} (plus applicable GST at 18%)
- **Advance Payment:** ₹${data.advanceAmount.toLocaleString('en-IN')} (due upon signing this Agreement)
- **Final Payment:** ₹${data.finalAmount.toLocaleString('en-IN')} (due by ${data.paymentDueDate})
- **Payment Method:** Bank transfer, UPI, or as mutually agreed

All payments are due within 15 days of invoice date. Late payments shall attract interest at 1.5% per month on the outstanding amount.

${commonClauses(data)}
${standardClauses(data)}`;
}

// ─── Monthly Retainer Contract ─────────

function retainerContract(data: ContractData): string {
  return `# Monthly Retainer Agreement

**Date:** ${new Date().toLocaleDateString('en-IN')}

This Monthly Retainer Agreement ("Agreement") is entered into between:

**Service Provider:** ${data.agencyName}, located at ${data.agencyAddress}${data.agencyGST ? `, GSTIN: ${data.agencyGST}` : ''} ("the Agency")

**Client:** ${data.clientName}, located at ${data.clientAddress}${data.clientGST ? `, GSTIN: ${data.clientGST}` : ''} ("the Client")

---

## 1. Scope of Services

The Agency agrees to provide the following services on a monthly retainer basis:

**Description:** ${data.projectDescription}

The retainer includes:
- Monthly hours as specified above (unused hours do not roll over)
- Regular strategy meetings (1 per month minimum)
- Monthly performance reporting
- Priority response within 24 business hours
- Ad-hoc tasks within the retainer hours

Services beyond the retainer scope will be billed separately at ₹2,000/hour.

## 2. Term and Renewal

- **Start Date:** ${data.startDate}
- **Minimum Commitment:** 3 months
- **Auto-Renewal:** This Agreement auto-renews monthly after the minimum term unless either Party provides 30 days' written notice of non-renewal.

## 3. Investment

- **Monthly Retainer:** ₹${data.totalValue.toLocaleString('en-IN')}/month (plus applicable GST at 18%)
- **Advance Payment:** ₹${data.advanceAmount.toLocaleString('en-IN')} (first month's retainer)
- **Subsequent Payments:** Due on the 1st of each month
- **Payment Method:** Bank transfer, UPI, or as mutually agreed

${commonClauses(data)}
${standardClauses(data)}`;
}

// ─── SEO Services Contract ─────────────

function seoContract(data: ContractData): string {
  return `# SEO Services Agreement

**Date:** ${new Date().toLocaleDateString('en-IN')}

This SEO Services Agreement ("Agreement") is entered into between:

**Service Provider:** ${data.agencyName}, located at ${data.agencyAddress}${data.agencyGST ? `, GSTIN: ${data.agencyGST}` : ''} ("the Agency")

**Client:** ${data.clientName}, located at ${data.clientAddress}${data.clientGST ? `, GSTIN: ${data.clientGST}` : ''} ("the Client")

---

## 1. Scope of SEO Services

**Project Description:** ${data.projectDescription}

Services include:
- Technical SEO audit and implementation
- On-page optimization (title tags, meta descriptions, schema markup)
- Content strategy and creation (as per agreed scope)
- Link building and outreach
- Monthly performance reporting with ranking updates
- Local SEO optimization (if applicable)

**Important Disclaimer:** The Agency makes no guarantees regarding specific search engine rankings, as search engine algorithms are controlled by third parties and change frequently. SEO results typically take 3-6 months to materialize.

## 2. Timeline and Reporting

- **Start Date:** ${data.startDate}
- **Initial Audit Delivery:** Within 2 weeks of start
- **Monthly Reports:** Delivered by the 5th of each month
- **Strategy Review:** Quarterly meeting to assess progress and adjust strategy

## 3. Investment

- **Total Contract Value:** ₹${data.totalValue.toLocaleString('en-IN')}/month (plus applicable GST at 18%)
- **Setup Fee:** ₹${data.advanceAmount.toLocaleString('en-IN')}
- **Monthly Fee:** Due on the 1st of each month
- **Payment Method:** Bank transfer, UPI, or as mutually agreed

**Disclaimer:** This analysis and all recommendations are for educational and professional purposes only. All investment decisions regarding SEO strategy are the Client's. Past ranking improvements do not guarantee future results.

${commonClauses(data)}
${standardClauses(data)}`;
}

// ─── Social Media Contract ─────────────

function socialMediaContract(data: ContractData): string {
  return `# Social Media Marketing Agreement

**Date:** ${new Date().toLocaleDateString('en-IN')}

This Social Media Marketing Agreement ("Agreement") is entered into between:

**Service Provider:** ${data.agencyName}, located at ${data.agencyAddress}${data.agencyGST ? `, GSTIN: ${data.agencyGST}` : ''} ("the Agency")

**Client:** ${data.clientName}, located at ${data.clientAddress}${data.clientGST ? `, GSTIN: ${data.clientGST}` : ''} ("the Client")

---

## 1. Scope of Services

**Project Description:** ${data.projectDescription}

Services include:
- Content calendar creation and management
- Post creation (graphics, copy, hashtags) for agreed platforms
- Community management and response
- Monthly analytics reporting
- Content scheduling and publishing
- Monthly strategy calls

**Platforms covered:** As mutually agreed upon in the project brief.

## 2. Content Approval

All content shall be submitted for Client approval at least 48 hours before the scheduled posting date. Content not rejected within 48 hours of submission shall be deemed approved.

The Client retains the right to request reasonable revisions to content before publication.

## 3. Term and Renewal

- **Start Date:** ${data.startDate}
- **Minimum Commitment:** 3 months
- **Auto-Renewal:** Monthly after minimum term with 30 days' notice for termination.

## 4. Investment

- **Monthly Fee:** ₹${data.totalValue.toLocaleString('en-IN')}/month (plus applicable GST at 18%)
- **Advance Payment:** ₹${data.advanceAmount.toLocaleString('en-IN')}
- **Final Payment:** ₹${data.finalAmount.toLocaleString('en-IN')}
- **Payment Method:** Bank transfer, UPI, or as mutually agreed

${commonClauses(data)}
${standardClauses(data)}`;
}

// ─── NDA Contract ──────────────────────

function ndaContract(data: ContractData): string {
  return `# Non-Disclosure Agreement

**Date:** ${new Date().toLocaleDateString('en-IN')}

This Non-Disclosure Agreement ("Agreement") is entered into between:

**Party A:** ${data.agencyName}, located at ${data.agencyAddress} ("the Agency")

**Party B:** ${data.clientName}, located at ${data.clientAddress} ("the Client")

---

## 1. Purpose

The Parties wish to explore a potential business relationship concerning: ${data.projectDescription}

In connection with this exploration, each Party may disclose confidential information to the other Party. This Agreement protects the disclosure of such confidential information.

## 2. Definition of Confidential Information

"Confidential Information" means any information disclosed by either Party that is:
- Marked as confidential or proprietary
- Identified as confidential at the time of disclosure
- Information that a reasonable person would understand to be confidential

This includes, but is not limited to: business plans, financial information, client lists, proprietary processes, trade secrets, technical data, marketing strategies, and any other proprietary information.

## 3. Obligations

Each receiving Party agrees to:
- Hold all Confidential Information in strict confidence
- Not disclose Confidential Information to any third party without prior written consent
- Use the Confidential Information solely for the purpose of evaluating and pursuing the business relationship
- Take reasonable security measures to protect the confidentiality of the information

## 4. Exclusions

Confidential Information does not include information that:
- Is or becomes publicly available through no fault of the receiving Party
- Was already known to the receiving Party prior to disclosure
- Is independently developed without use of the Confidential Information
- Is rightfully received from a third party without restriction

## 5. Term

This Agreement shall remain in effect for a period of 2 (two) years from the date of disclosure. The obligations of confidentiality shall survive termination of this Agreement for an additional 3 (three) years.

## 6. Return of Materials

Upon termination of the business relationship or upon written request, each Party shall promptly return or destroy all documents and materials containing Confidential Information and certify such return or destruction in writing.

## 7. Remedies

The Parties acknowledge that unauthorized disclosure of Confidential Information may cause irreparable harm. The disclosing Party shall be entitled to seek injunctive relief, in addition to any other remedies available at law or in equity, in the jurisdiction of ${data.jurisdiction || 'the courts of competent jurisdiction'}.

## 8. Governing Law

This Agreement shall be governed by and construed in accordance with the laws of India. Any dispute shall be subject to the exclusive jurisdiction of the courts of ${data.jurisdiction || 'the courts of competent jurisdiction'}.

---

**AGREED AND ACCEPTED:**

**Party A — ${data.agencyName}:**

Signature: _______________________

Name: _______________________

Date: _______________________

**Party B — ${data.clientName}:**

Signature: _______________________

Name: _______________________

Date: _______________________`;
}

import { downloadBlob } from '@/lib/download-blob';

// ─── Export Contract as PDF ────────────

export async function exportContractPDF(contractText: string, filename: string): Promise<void> {
  try {
    const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    const html2canvas = html2canvasModule.default;

    // Simple markdown to HTML conversion
    const html = `<div style="font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;padding:40px;font-size:13px;line-height:1.7;color:#1f2937">
      ${contractText
        .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;color:#111;margin-bottom:8px">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;color:#111;margin-top:24px;margin-bottom:8px">$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n---\n/g, '<hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">')
        .replace(/\n\n/g, '</p><p style="margin:6px 0">')
        .replace(/\n- /g, '</p><p style="margin:4px 0;padding-left:16px">• ')
        .replace(/\n/g, '<br>')
      }
    </div>`;

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:750px;background:#fff';
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#fff', width: 750 });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } catch (e) {
    console.warn('[Contracts] PDF export failed, falling back to text download:', e);
    // Fallback: download as text
    downloadBlob(contractText, filename.replace('.pdf', '.txt'), 'text/plain');
  }
}
