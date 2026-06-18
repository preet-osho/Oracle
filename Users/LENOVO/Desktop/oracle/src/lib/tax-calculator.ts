// ═══════════════════════════════════════
// ORACLE — GST/Tax Calculator (India)
// Calculate GST, TDS, and other Indian taxes
// ═══════════════════════════════════════

export interface GSTBreakdown {
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  gstRate: number;
  isInterstate: boolean;
}

// GST Rates (common for digital services)
export const GST_RATES = {
  standard: 18,    // Most digital/IT services
  reduced: 12,     // Some services
  exempt: 0,       // Exempt services
} as const;

/**
 * Calculate GST breakdown for an invoice
 */
export function calculateGST(
  baseAmount: number,
  gstRate: number = GST_RATES.standard,
  isInterstate: boolean = false
): GSTBreakdown {
  const totalTax = (baseAmount * gstRate) / 100;

  if (isInterstate) {
    return {
      baseAmount,
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      totalTax,
      totalAmount: baseAmount + totalTax,
      gstRate,
      isInterstate: true,
    };
  }

  // Intra-state: split into CGST + SGST
  const halfTax = totalTax / 2;
  return {
    baseAmount,
    cgst: halfTax,
    sgst: halfTax,
    igst: 0,
    totalTax,
    totalAmount: baseAmount + totalTax,
    gstRate,
    isInterstate: false,
  };
}

/**
 * Format amount in INR
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


