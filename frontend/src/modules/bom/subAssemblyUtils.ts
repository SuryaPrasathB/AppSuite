export interface SubAssemblyPart {
  id?: number | string;
  product_id: number | null;
  product_name: string;
  part_number: string;
  manufacturer: string;
  link?: string;
  quantity_required: number;
  unit_price: number;
  product_unit?: string;
  current_stock?: number;
  remarks?: string;
  custom_fields?: Record<string, string>;
}

export interface SubAssemblyDefinition {
  uid: string; // e.g. 'lib-1' or 'inline-10-42'
  sourceType: 'library' | 'inline';
  subAssemblyId?: number;
  sourceBomId?: number;
  sourceBomName?: string;
  inlineParentItemId?: number;
  name: string;
  code: string;
  category: string;
  revision: string;
  parts: SubAssemblyPart[];
  totalUnitCost: number;
  buildableSets: number | null; // null if all parts are non-catalog manual items
  shortfallPartsCount: number;
}

/**
 * Extracts all reusable Sub-Assemblies from the dedicated `sub_assemblies` library
 * (plus any inline sub-assemblies inside existing BOMs) with complete part lists,
 * rolled-up unit costs, and store stock buildability metrics.
 */
export function extractSubAssemblies(
  librarySubAssemblies: any[] = [],
  boms: any[] = []
): SubAssemblyDefinition[] {
  const result: SubAssemblyDefinition[] = [];
  const seenLibraryNames = new Set<string>();

  // 1. Dedicated Library Sub-Assemblies (from `/api/boms/sub-assemblies`)
  for (const sa of librarySubAssemblies || []) {
    const rawItems: any[] = Array.isArray(sa.items) ? sa.items : [];
    const parts: SubAssemblyPart[] = rawItems.map(it => ({
      id: it.id,
      product_id: it.product_id ?? null,
      product_name: it.product_name || it.manual_product_name || 'Component',
      part_number:
        it.part_number ||
        (it.product_code && it.product_code !== 'MANUAL' ? it.product_code : '') ||
        '',
      manufacturer: it.manufacturer || '',
      link: it.link || '',
      quantity_required: Number(it.quantity_required) || 1,
      unit_price: Number(it.unit_price) || 0,
      product_unit: it.product_unit || 'pcs',
      current_stock: Number(it.current_stock) || 0,
      remarks: it.remarks || '',
      custom_fields: it.custom_fields || {}
    }));

    const totalUnitCost = parts.reduce((sum, p) => sum + p.unit_price * p.quantity_required, 0);
    const catalogParts = parts.filter(p => p.product_id);
    const buildableSets =
      catalogParts.length > 0
        ? Math.min(
            ...catalogParts.map(p =>
              p.quantity_required > 0
                ? Math.floor((p.current_stock || 0) / p.quantity_required)
                : 0
            )
          )
        : null;
    const shortfallPartsCount = catalogParts.filter(
      p => (p.current_stock || 0) < p.quantity_required
    ).length;

    seenLibraryNames.add((sa.name || '').trim().toLowerCase());

    result.push({
      uid: `lib-${sa.id}`,
      sourceType: 'library',
      subAssemblyId: sa.id,
      name: sa.name,
      code: sa.code || `SA-${String(sa.id).padStart(3, '0')}`,
      category: sa.category || 'Sub-Assembly',
      revision: 'A',
      parts,
      totalUnitCost,
      buildableSets,
      shortfallPartsCount
    });
  }

  // 2. Inline Sub-Assemblies defined inside existing BOMs (bom_items where is_assembly === true)
  for (const b of boms || []) {
    const rawItems: any[] = Array.isArray(b.items) ? b.items : [];
    const assemblyHeaders = rawItems.filter(
      i => i.is_assembly || rawItems.some(child => child.parent_item_id === i.id)
    );

    for (const header of assemblyHeaders) {
      const headerName = (header.product_name || header.manual_product_name || '').trim();
      if (!headerName) continue;
      if (seenLibraryNames.has(headerName.toLowerCase())) continue;

      const children = rawItems.filter(c => c.parent_item_id === header.id);
      const headerQty = Math.max(1, Number(header.quantity_required) || 1);

      const parts: SubAssemblyPart[] = children.map(it => {
        const normQty = Number(((Number(it.quantity_required) || 1) / headerQty).toFixed(4));
        return {
          id: it.id,
          product_id: it.product_id ?? null,
          product_name: it.product_name || it.manual_product_name || 'Component',
          part_number:
            it.part_number ||
            (it.product_code && it.product_code !== 'MANUAL' ? it.product_code : '') ||
            '',
          manufacturer: it.manufacturer || '',
          link: it.link || '',
          quantity_required: normQty > 0 ? normQty : 1,
          unit_price: Number(it.unit_price) || 0,
          product_unit: it.product_unit || 'pcs',
          current_stock: Number(it.current_stock) || 0,
          remarks: it.remarks || '',
          custom_fields: it.custom_fields || {}
        };
      });

      const totalUnitCost =
        parts.length > 0
          ? parts.reduce((sum, p) => sum + p.unit_price * p.quantity_required, 0)
          : Number(header.unit_price) || 0;

      const catalogParts = parts.filter(p => p.product_id);
      const buildableSets =
        catalogParts.length > 0
          ? Math.min(
              ...catalogParts.map(p =>
                p.quantity_required > 0
                  ? Math.floor((p.current_stock || 0) / p.quantity_required)
                  : 0
              )
            )
          : null;
      const shortfallPartsCount = catalogParts.filter(
        p => (p.current_stock || 0) < p.quantity_required
      ).length;

      result.push({
        uid: `inline-${b.id}-${header.id}`,
        sourceType: 'inline',
        sourceBomId: b.id,
        sourceBomName: b.name,
        inlineParentItemId: header.id,
        name: headerName,
        code: header.part_number || `SA-${b.id}-${header.id}`,
        category: `From BOM: ${b.name}`,
        revision: b.revision || 'A',
        parts,
        totalUnitCost,
        buildableSets,
        shortfallPartsCount
      });
    }
  }

  return result;
}
