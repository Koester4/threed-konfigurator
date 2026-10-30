import { CONFIG } from './config.js';

/**
 * Schätzt Material, Druckzeit und Preis für ein Modell.
 * `stats` sind die Werte des unskalierten Modells in mm, `scale` der Gesamtfaktor.
 */
export function calculatePrice({ stats, scale, material, infill, quality, finishing, quantity, supports }) {
  const volumeCm3 = (stats.volumeMm3 * scale ** 3) / 1000;
  const areaCm2 = (stats.areaMm2 * scale ** 2) / 100;

  // Außenhülle wird immer voll gedruckt, das Innere mit dem gewählten Füllgrad
  const shellCm3 = Math.min(volumeCm3, areaCm2 * (CONFIG.wallThicknessMm / 10));
  const infillValue = material.solid ? 1 : infill.value;
  const partCm3 = shellCm3 + (volumeCm3 - shellCm3) * infillValue;
  const supportCm3 = supports ? partCm3 * CONFIG.supportFactor : 0;
  const printedCm3 = partCm3 + supportCm3;

  const weightG = printedCm3 * material.density;
  const hours = printedCm3 / (material.throughputCm3h * quality.speedFactor);

  const materialCost = (weightG / 1000) * material.pricePerKg;
  const machineCost = hours * (material.machineRatePerHour ?? CONFIG.machineRatePerHour);
  const finishingCost = areaCm2 * finishing.pricePerCm2;
  const unitPrice = materialCost + machineCost + finishingCost;

  const discount = [...CONFIG.quantityDiscounts]
    .sort((a, b) => b.min - a.min)
    .find((tier) => quantity >= tier.min)?.discount ?? 0;

  const itemsTotal = unitPrice * quantity;
  const discountAmount = itemsTotal * discount;
  let net = itemsTotal - discountAmount + CONFIG.setupFee;
  const minOrderApplied = net < CONFIG.minOrder;
  if (minOrderApplied) net = CONFIG.minOrder;

  const vatAmount = net * CONFIG.vat;

  return {
    volumeCm3,
    areaCm2,
    weightG,
    hours,
    materialCost,
    machineCost,
    finishingCost,
    unitPrice,
    itemsTotal,
    discount,
    discountAmount,
    setupFee: CONFIG.setupFee,
    minOrderApplied,
    net,
    vatAmount,
    gross: net + vatAmount,
  };
}

/** Prüft, ob die Abmessungen (in mm) in den Bauraum passen – Drehung erlaubt. */
export function fitsBuildVolume(dims, material) {
  const limit = [...(material.maxSize ?? CONFIG.buildVolume)].sort((a, b) => a - b);
  const sorted = [...dims].sort((a, b) => a - b);
  return sorted.every((d, i) => d <= limit[i] + 1e-6);
}
