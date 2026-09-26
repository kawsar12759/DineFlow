import { describe, expect, it } from "vitest";
import { computeBill, lineTotal } from "@/lib/billing";

const charges = { vatPercent: 5, serviceChargePercent: 10 };

describe("lineTotal", () => {
  it("multiplies price by quantity and ignores voided lines", () => {
    expect(lineTotal({ unitPrice: 450, quantity: 3 })).toBe(1350);
    expect(lineTotal({ unitPrice: 450, quantity: 3, voided: true })).toBe(0);
  });
});

describe("computeBill", () => {
  it("adds service charge and VAT to the subtotal", () => {
    const bill = computeBill(
      [
        { unitPrice: 890, quantity: 2 },
        { unitPrice: 320, quantity: 1 },
      ],
      charges
    );

    expect(bill.subtotal).toBe(2100);
    expect(bill.serviceChargeAmount).toBe(210);
    expect(bill.vatAmount).toBe(105);
    expect(bill.total).toBe(2415);
  });

  it("charges both percentages on the discounted amount", () => {
    const bill = computeBill([{ unitPrice: 1000, quantity: 1 }], {
      ...charges,
      discountAmount: 200,
    });

    expect(bill.taxableAmount).toBe(800);
    expect(bill.serviceChargeAmount).toBe(80);
    expect(bill.vatAmount).toBe(40);
    expect(bill.total).toBe(920);
  });

  it("never lets a discount push the bill below zero", () => {
    const bill = computeBill([{ unitPrice: 500, quantity: 1 }], {
      ...charges,
      discountAmount: 900,
    });

    expect(bill.discountAmount).toBe(500);
    expect(bill.total).toBe(0);
  });

  it("leaves voided lines out of the money", () => {
    const bill = computeBill(
      [
        { unitPrice: 1000, quantity: 1 },
        { unitPrice: 500, quantity: 2, voided: true },
      ],
      charges
    );
    expect(bill.subtotal).toBe(1000);
    expect(bill.total).toBe(1150);
  });

  it("is zero for an empty order", () => {
    expect(computeBill([], charges)).toMatchObject({ subtotal: 0, total: 0 });
  });

  it("rounds to two decimals", () => {
    const bill = computeBill([{ unitPrice: 333.33, quantity: 3 }], {
      vatPercent: 7.5,
      serviceChargePercent: 0,
    });
    expect(bill.subtotal).toBe(999.99);
    expect(bill.vatAmount).toBe(75);
    expect(bill.total).toBe(1074.99);
  });

  it("charges nothing extra when both percentages are zero", () => {
    const bill = computeBill([{ unitPrice: 750, quantity: 2 }], {});
    expect(bill.total).toBe(1500);
  });
});
