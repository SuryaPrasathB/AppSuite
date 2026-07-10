export type ProductFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'textarea'
  | 'url'
  | 'date'
  | 'checkbox';

export interface ProductFieldOption {
  label: string;
  value: string;
  short?: string;
}

export interface ProductFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

export interface ProductFieldSchema {
  key: string;
  label: string;
  type: ProductFieldType;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: ProductFieldOption[];
  validation?: ProductFieldValidation;
  width?: 'full' | 'half' | 'third';
  unitSuffix?: string;
  summary?: boolean;
}

export interface ProductCategorySchema {
  id: string;
  label: string;
  description: string;
  icon?: string;
  codePrefix: string;
  nameTemplate: string;
  codeTemplate: string;
  fields: ProductFieldSchema[];
  defaults?: Record<string, string>;
}

export type ProductBuilderValues = Record<string, string>;
export type ProductBuilderErrors = Record<string, string>;

export interface ProductBuilderPayload {
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  min_quantity: number;
  max_quantity: number;
  initial_quantity: number;
  barcode: string;
  qr_code: string;
  image_url: string;
  vendor_ids: number[];
  preferred_vendor_id: number | null;
  standard_cost: number;
  latest_cost: number;
  average_cost: number;
  currency: string;
}

