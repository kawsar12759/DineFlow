/**
 * Bill arithmetic. Pure and rounded to whole poisha-free taka, because
 * Bangladeshi restaurant bills are settled in whole BDT.
 *
 * Order matters: service charge and VAT are both charged on the amount
 * after any discount, which is how restaurants here print their bills.
 */

export interface BillLine {
  unitPrice: number;
  quantity: number;
  /** Voided lines stay on the order for the record but are not charged. */
  voided?: boolean;
}

export interface BillCharges {
  /** Flat amount off the subtotal, in BDT. */
  discountAmount?: number;
  vatPercent?: number;
  serviceChargePercent?: number;
}

export interface BillTotals {
  subtotal: number;
  discountAmount: number;
  /** Subtotal minus discount — what the percentages are charged on. */
  taxableAmount: number;
  serviceChargeAmount: number;
  vatAmount: number;
  total: number;
}

function round(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function lineTotal(line: BillLine) {
  return line.voided ? 0 : round(line.unitPrice * line.quantity);
}

export function computeBill(
  lines: BillLine[],
  charges: BillCharges = {}
): BillTotals {
  const subtotal = round(
    lines.reduce((sum, line) => sum + lineTotal(line), 0)
  );

  // A discount can never exceed the bill or turn it negative.
  const discountAmount = round(
    Math.min(Math.max(charges.discountAmount ?? 0, 0), subtotal)
  );
  const taxableAmount = round(subtotal - discountAmount);

  const serviceChargeAmount = round(
    (taxableAmount * (charges.serviceChargePercent ?? 0)) / 100
  );
  const vatAmount = round((taxableAmount * (charges.vatPercent ?? 0)) / 100);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    serviceChargeAmount,
    vatAmount,
    total: round(taxableAmount + serviceChargeAmount + vatAmount),
  };
}
