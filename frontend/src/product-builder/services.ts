import type {
  ProductBuilderErrors,
  ProductBuilderValues,
  ProductCategorySchema,
  ProductFieldSchema,
} from './types';

const TOKEN_PATTERN = /\{([^}]+)\}/g;

const cleanGeneratedText = (value: string) =>
  value
    .replace(/,/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\s+(from|with)$/i, '')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();

export const renderTemplate = (
  template: string,
  values: ProductBuilderValues,
  schema?: ProductCategorySchema,
) => {
  const resolved = template.replace(TOKEN_PATTERN, (_, key: string) => {
    if (key === 'category') return schema?.label || schema?.description || '';
    if (key === 'categoryCode') return schema?.id || '';
    if (key === 'codePrefix') return schema?.codePrefix || '';
    return values[key]?.trim() || '';
  });
  return cleanGeneratedText(resolved);
};

export const ProductNameGenerator = {
  generate(schema: ProductCategorySchema, values: ProductBuilderValues) {
    return renderTemplate(schema.nameTemplate, values, schema);
  },
};

const codeToken = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' AND ')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

export const ItemCodeGenerator = {
  generate(schema: ProductCategorySchema, values: ProductBuilderValues) {
    const enrichedValues = { ...values };
    schema.fields.forEach((field) => {
      const selected = field.options?.find((option) => option.value === values[field.key]);
      if (selected?.short) {
        enrichedValues[field.key] = selected.short;
        enrichedValues[`${field.key}Short`] = selected.short;
      }
    });

    return schema.codeTemplate
      .replace(TOKEN_PATTERN, (_, key: string) => {
        if (key === 'categoryCode') return codeToken(schema.id);
        if (key === 'codePrefix') return codeToken(schema.codePrefix);
        return codeToken(enrichedValues[key] || '');
      })
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  },
};

const validateField = (field: ProductFieldSchema, value = '') => {
  const rules = field.validation;
  if (!rules) return '';
  const trimmed = value.trim();

  if (rules.required && !trimmed) return `${field.label} is required.`;
  if (!trimmed) return '';
  if (rules.minLength && trimmed.length < rules.minLength) {
    return rules.message || `${field.label} must contain at least ${rules.minLength} characters.`;
  }
  if (rules.maxLength && trimmed.length > rules.maxLength) {
    return rules.message || `${field.label} must contain no more than ${rules.maxLength} characters.`;
  }
  if (field.type === 'number') {
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) return `${field.label} must be a number.`;
    if (rules.min !== undefined && numeric < rules.min) return `${field.label} must be at least ${rules.min}.`;
    if (rules.max !== undefined && numeric > rules.max) return `${field.label} must be at most ${rules.max}.`;
  }
  if (rules.pattern && !new RegExp(rules.pattern).test(trimmed)) {
    return rules.message || `${field.label} is not valid.`;
  }
  return '';
};

export const validateProduct = (
  fields: ProductFieldSchema[],
  values: ProductBuilderValues,
): ProductBuilderErrors =>
  fields.reduce<ProductBuilderErrors>((errors, field) => {
    const error = validateField(field, values[field.key]);
    if (error) errors[field.key] = error;
    return errors;
  }, {});

export const buildMetadataDescription = (
  schema: ProductCategorySchema,
  values: ProductBuilderValues,
) =>
  JSON.stringify({
    schemaVersion: 1,
    categoryId: schema.id,
    specifications: Object.fromEntries(
      schema.fields.map((field) => [field.key, values[field.key] || '']),
    ),
    store: {
      reorderLevel: values.reorderLevel || '',
      rack: values.rack || '',
      shelf: values.shelf || '',
      bin: values.bin || '',
      warehouse: values.warehouse || '',
      zone: values.zone || '',
      remarks: values.remarks || '',
    },
    additional: {
      supplier: values.supplier || '',
      supplierPartNumber: values.supplierPartNumber || '',
      manufacturerPartNumber: values.manufacturerPartNumber || '',
      catalogNumber: values.catalogNumber || '',
      warranty: values.warranty || '',
      countryOfOrigin: values.countryOfOrigin || '',
      datasheetUrl: values.datasheetUrl || '',
      notes: values.notes || '',
    },
  });
