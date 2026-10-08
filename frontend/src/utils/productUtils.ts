/**
 * Utility functions for product data normalization and display
 */

export function getProductManufacturer(product: any): string {
  if (!product) return '';

  // 1. Check direct manufacturer property
  if (typeof product.manufacturer === 'string' && product.manufacturer.trim()) {
    const direct = product.manufacturer.trim();
    if (direct.toLowerCase() !== 'unknown') {
      return direct;
    }
  }

  // 2. Check JSON description specifications / additional
  if (product.description) {
    try {
      const parsed = typeof product.description === 'string'
        ? JSON.parse(product.description)
        : product.description;

      if (parsed && typeof parsed === 'object') {
        const specMfg = parsed.specifications?.manufacturer;
        if (typeof specMfg === 'string' && specMfg.trim() && specMfg.trim().toLowerCase() !== 'unknown') {
          return specMfg.trim();
        }

        const addlMfg = parsed.additional?.manufacturer || parsed.additional?.brand;
        if (typeof addlMfg === 'string' && addlMfg.trim() && addlMfg.trim().toLowerCase() !== 'unknown') {
          return addlMfg.trim();
        }
      }
    } catch {
      // Ignore JSON parse errors for non-JSON descriptions
    }
  }

  // 3. Fallback to direct manufacturer even if unknown or empty
  if (typeof product.manufacturer === 'string' && product.manufacturer.trim()) {
    return product.manufacturer.trim();
  }

  return '';
}

export function getProductPartNumber(product: any): string {
  if (!product) return '';

  // Check JSON description first for explicit partNumber or MPN
  if (product.description) {
    try {
      const parsed = typeof product.description === 'string'
        ? JSON.parse(product.description)
        : product.description;

      if (parsed && typeof parsed === 'object') {
        const partNo = parsed.specifications?.partNumber ||
                       parsed.additional?.manufacturerPartNumber ||
                       parsed.additional?.catalogNumber;
        if (typeof partNo === 'string' && partNo.trim()) {
          return partNo.trim();
        }
      }
    } catch {
      // Ignore
    }
  }

  // Barcode fallback
  if (typeof product.barcode === 'string' && product.barcode.trim()) {
    return product.barcode.trim();
  }

  return '';
}
