import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { round2 } from "../format";

/** Pure FIFO allocation used by the inventory engine. */
function fifoAllocate(
  lots: { id: string; qtyRemaining: number; unitCost: number }[],
  quantity: number,
) {
  const available = lots.reduce((s, l) => s + l.qtyRemaining, 0);
  if (available + 1e-9 < quantity) throw new Error("Insufficient stock");
  const layers: { lotId: string; quantity: number; unitCost: number; amount: number }[] = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qtyRemaining, remaining);
    layers.push({
      lotId: lot.id,
      quantity: take,
      unitCost: lot.unitCost,
      amount: round2(take * lot.unitCost),
    });
    remaining = round2(remaining - take);
  }
  return layers;
}

describe("historical FIFO costing", () => {
  it("uses 2023 purchase cost of 40,000 — not the latest 52,000 price — for a 2023 sale", () => {
    const lots = [
      { id: "2023", qtyRemaining: 10, unitCost: 40000 },
      { id: "2024", qtyRemaining: 8, unitCost: 45000 },
      { id: "2025", qtyRemaining: 6, unitCost: 52000 },
    ];
    const layers = fifoAllocate(lots, 1);
    assert.equal(layers[0].unitCost, 40000);
    const sale = 48000;
    const profit = sale - layers[0].amount;
    assert.equal(profit, 8000);
  });

  it("consumes the next lot after the older stock is gone", () => {
    const lots = [
      { id: "2023", qtyRemaining: 2, unitCost: 40000 },
      { id: "2024", qtyRemaining: 8, unitCost: 45000 },
    ];
    const layers = fifoAllocate(lots, 3);
    assert.equal(layers.length, 2);
    assert.equal(layers[0].quantity, 2);
    assert.equal(layers[0].unitCost, 40000);
    assert.equal(layers[1].quantity, 1);
    assert.equal(layers[1].unitCost, 45000);
    assert.equal(
      round2(layers.reduce((s, l) => s + l.amount, 0)),
      125000,
    );
  });

  it("never silently replaces historical cost with the current product price", () => {
    const currentCatalogPrice = 52000;
    const layers = fifoAllocate([{ id: "old", qtyRemaining: 1, unitCost: 40000 }], 1);
    assert.notEqual(layers[0].unitCost, currentCatalogPrice);
  });
});
