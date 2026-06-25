import type { ProductCategorySchema, ProductFieldSchema } from './types';

const required = { required: true };

const DEFAULT_MANUFACTURERS = [
  { label: 'Schneider Electric', value: 'Schneider Electric', short: 'SCH' },
  { label: 'Siemens', value: 'Siemens', short: 'SIE' },
  { label: 'ABB', value: 'ABB', short: 'ABB' },
  { label: 'L&T', value: 'L&T', short: 'LNT' },
  { label: 'Omron', value: 'Omron', short: 'OMR' },
  { label: 'Phoenix Contact', value: 'Phoenix Contact', short: 'PHX' },
  { label: 'Rockwell Automation', value: 'Rockwell Automation', short: 'RKA' },
  { label: 'Mitsubishi Electric', value: 'Mitsubishi Electric', short: 'MIT' },
  { label: 'LAPP', value: 'LAPP', short: 'LAP' },
  { label: 'Generic / Other', value: 'Generic', short: 'GEN' },
];

const manufacturers = [...DEFAULT_MANUFACTURERS];

try {
  const stored = localStorage.getItem('custom_manufacturers');
  if (stored) {
    const parsed = JSON.parse(stored);
    manufacturers.push(...parsed);
  }
} catch (e) {
  console.error('Failed to load custom manufacturers', e);
}

const saveCustomManufacturers = () => {
  const custom = manufacturers.filter(
    (m) => !DEFAULT_MANUFACTURERS.some((def) => def.label === m.label)
  );
  try {
    localStorage.setItem('custom_manufacturers', JSON.stringify(custom));
  } catch (e) {
    console.error('Failed to save custom manufacturers', e);
  }
};

export const addManufacturer = (label: string, short: string) => {
  manufacturers.push({ label, value: label, short });
  saveCustomManufacturers();
};

export const removeManufacturer = (label: string) => {
  const index = manufacturers.findIndex((m) => m.label === label);
  if (index !== -1) {
    manufacturers.splice(index, 1);
    saveCustomManufacturers();
  }
};

const manufacturerField: ProductFieldSchema = {
  key: 'manufacturer',
  label: 'Manufacturer',
  type: 'select',
  options: manufacturers,
  validation: required,
  width: 'third',
  summary: true,
};

const text = (
  key: string,
  label: string,
  isRequired = false,
  options?: string[],
): ProductFieldSchema => ({
  key,
  label,
  type: options ? 'select' : 'text',
  options: options?.map((value) => ({ label: value, value })),
  validation: isRequired ? required : undefined,
  width: 'third',
  summary: key === 'model' || key === 'series',
});

const category = (
  id: string,
  label: string,
  description: string,
  fields: ProductFieldSchema[],
  nameTemplate = '{description}, {series} {model}',
  codeTemplate = '{codePrefix}-{manufacturerShort}-{series}',
): ProductCategorySchema => ({
  id,
  label,
  description,
  codePrefix: id.slice(0, 3),
  nameTemplate: nameTemplate.replace('{description}', description),
  codeTemplate,
  fields: [manufacturerField, ...fields],
});

export const PRODUCT_CATEGORY_SCHEMAS: ProductCategorySchema[] = [
  {
    id: 'MCB',
    label: 'MCB',
    description: 'Miniature Circuit Breaker (MCB)',
    codePrefix: 'MCB',
    nameTemplate:
      '{category}, {series} {model}, {poles}, {current}, {curve} Curve, {breakingCapacity} ({standard})',
    codeTemplate:
      '{codePrefix}-{manufacturerShort}-{series}-{poles}-{current}-{curve}-{breakingCapacity}',
    fields: [
      manufacturerField,
      text('partNumber', 'Part Number', false),
      text('series', 'Series', false),
      text('model', 'Model / Product Family', false),
      text('poles', 'Poles', true, ['1P', '1P+N', '2P', '3P', '3P+N', '4P']),
      text('current', 'Current Rating', true, ['1A', '2A', '6A', '10A', '16A', '20A', '32A', '40A', '63A']),
      text('curve', 'Curve / Tripping Curve', true, ['B', 'C', 'D', 'K', 'Z']),
      text('breakingCapacity', 'Breaking Capacity', true, ['6kA', '10kA', '15kA', '25kA']),
      text('standard', 'Standard / Compliance', false, ['IEC 60898-1', 'IS/IEC 60947-2', 'IEC 60947-2']),
      text('frequency', 'Frequency', false, ['50Hz', '60Hz', '50/60Hz']),
    ],
    defaults: { poles: '1P', current: '1A', curve: 'C', breakingCapacity: '10kA', frequency: '50/60Hz' },
  },
  {
    id: 'RELAY',
    label: 'Relay',
    description: 'Industrial Relay',
    codePrefix: 'REL',
    nameTemplate:
      '{relayType}, {series} {model}, {contactConfiguration}, {coilVoltage} Coil, {contactRating}, {mountingType}',
    codeTemplate:
      '{codePrefix}-{manufacturerShort}-{series}-{contactConfiguration}-{coilVoltage}-{contactRating}',
    fields: [
      manufacturerField,
      text('partNumber', 'Part Number', false),
      text('relayType', 'Relay Type', true, ['Plug-in Relay', 'Interface Relay', 'Solid State Relay', 'Safety Relay', 'Timer Relay']),
      text('series', 'Series', false),
      text('model', 'Model', false),
      text('coilVoltage', 'Coil Voltage', true, ['12V DC', '24V DC', '48V DC', '110V AC', '230V AC']),
      text('contactConfiguration', 'Contact Configuration', true, ['1 CO (SPDT)', '2 CO (DPDT)', '3 CO', '4 CO']),
      text('contactRating', 'Contact Rating', true, ['5A', '6A', '10A', '16A']),
      text('mountingType', 'Mounting Type', true, ['Plug-in (Socket Mount)', 'DIN Rail', 'PCB Mount', 'Panel Mount']),
      text('operatingIndicator', 'Operating Indicator', false, ['None', 'LED', 'Mechanical + LED']),
      text('standard', 'Standard / Compliance'),
    ],
    defaults: { relayType: 'Plug-in Relay', coilVoltage: '24V DC', contactConfiguration: '2 CO (DPDT)', contactRating: '10A' },
  },
  {
    id: 'CABLE',
    label: 'Cable',
    description: 'Industrial Cable',
    codePrefix: 'CAB',
    nameTemplate:
      '{cableType}, {coreCount}, {conductorSize}, {color}, {length}',
    codeTemplate:
      '{codePrefix}-{manufacturerShort}-{cableType}-{coreCount}-{conductorSize}-{length}',
    fields: [
      manufacturerField,
      text('partNumber', 'Part Number', false),
      text('cableType', 'Cable Type', true, ['Power Cable', 'Control Cable', 'Instrumentation Cable', 'Ethernet Cable', 'Flexible Cable']),
      text('series', 'Series', false),
      text('coreCount', 'Core Count', true, ['1C', '2C', '3C', '4C', '5C', '7C', '12C', '24C']),
      text('conductorSize', 'Conductor Size', true, ['0.5 sq.mm', '0.75 sq.mm', '1.5 sq.mm', '2.5 sq.mm', '4 sq.mm', '6 sq.mm']),
      text('color', 'Color'),
      { ...text('length', 'Length', true), type: 'number', unitSuffix: 'm', validation: { required: true, min: 0.01 } },
      text('shielding', 'Shielding', false, ['Unshielded', 'Shielded', 'Armoured']),
      text('standard', 'Standard / Compliance'),
    ],
    defaults: { cableType: 'Control Cable', coreCount: '4C', conductorSize: '2.5 sq.mm' },
  },
  {
    id: 'PLC',
    label: 'PLC',
    description: 'Programmable Logic Controller (PLC)',
    codePrefix: 'PLC',
    nameTemplate:
      '{category}, {series} {model}, {cpuType}, {ioCount} I/O, {communication}',
    codeTemplate:
      '{codePrefix}-{manufacturerShort}-{series}-{cpuType}-{ioCount}',
    fields: [
      manufacturerField,
      text('partNumber', 'Part Number', false),
      text('series', 'Series', false),
      text('model', 'Model', false),
      text('cpuType', 'CPU Type', true),
      text('communication', 'Communication', true),
      { ...text('ioCount', 'I/O Count', true), type: 'number', validation: { required: true, min: 0 } },
      text('supplyVoltage', 'Supply Voltage'),
      text('programMemory', 'Program Memory'),
    ],
  },
  category('MCCB', 'MCCB', 'Moulded Case Circuit Breaker (MCCB)', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('poles', 'Poles', true),
    text('current', 'Frame / Current Rating', true), text('breakingCapacity', 'Breaking Capacity', true),
    text('tripUnit', 'Trip Unit', true), text('standard', 'Standard / Compliance'),
  ], '{description}, {series} {model}, {poles}, {current}, {breakingCapacity}, {tripUnit}',
  '{codePrefix}-{manufacturerShort}-{series}-{poles}-{current}-{breakingCapacity}'),
  category('ACB', 'ACB', 'Air Circuit Breaker (ACB)', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('poles', 'Poles', true),
    text('current', 'Current Rating', true), text('breakingCapacity', 'Breaking Capacity', true), text('drawout', 'Mounting', true),
  ], '{description}, {series} {model}, {poles}, {current}, {breakingCapacity}'),
  category('CONTACTOR', 'Contactor', 'Contactor', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('coilVoltage', 'Coil Voltage', true),
    text('current', 'Operational Current', true), text('poles', 'Poles', true), text('utilizationCategory', 'Utilization Category'),
  ], '{description}, {series} {model}, {poles}, {current}, {coilVoltage}'),
  category('HMI', 'HMI', 'Human Machine Interface (HMI)', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('displaySize', 'Display Size', true),
    text('resolution', 'Resolution'), text('communication', 'Communication', true), text('supplyVoltage', 'Supply Voltage'),
  ], '{description}, {series} {model}, {displaySize}, {supplyVoltage}'),
  category('SENSOR', 'Sensor', 'Industrial Sensor', [
    text('partNumber', 'Part Number', false), text('sensorType', 'Sensor Type', true), text('series', 'Series', false), text('model', 'Model', false),
    text('sensingRange', 'Sensing Range', true), text('outputType', 'Output Type', true), text('supplyVoltage', 'Supply Voltage'),
  ], '{sensorType}, {series} {model}, {sensingRange}, {outputType}'),
  category('TERMINAL', 'Terminal Block', 'Terminal Block', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('terminalType', 'Terminal Type', true),
    text('conductorSize', 'Conductor Size', true), text('current', 'Current Rating'), text('color', 'Color'),
  ], '{terminalType}, {series} {model}, {conductorSize}, {current}, {color}'),
  category('SMPS', 'SMPS', 'Switched Mode Power Supply (SMPS)', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('inputVoltage', 'Input Voltage', true),
    text('outputVoltage', 'Output Voltage', true), text('outputCurrent', 'Output Current', true), text('power', 'Power Rating'),
  ], '{description}, {series} {model}, {outputVoltage}, {outputCurrent}, {power}'),
  category('TRANSFORMER', 'Transformer', 'Electrical Transformer', [
    text('partNumber', 'Part Number', false), text('transformerType', 'Transformer Type', true), text('model', 'Model', false), text('primaryVoltage', 'Primary Voltage', true),
    text('secondaryVoltage', 'Secondary Voltage', true), text('power', 'VA / Power Rating', true), text('frequency', 'Frequency'),
  ], '{transformerType}, {model}, {primaryVoltage}/{secondaryVoltage}, {power}'),
  category('VFD', 'VFD', 'Variable Frequency Drive (VFD)', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('power', 'Motor Power', true),
    text('inputVoltage', 'Input Voltage', true), text('outputCurrent', 'Output Current'), text('communication', 'Communication'),
  ], '{description}, {series} {model}, {power}, {inputVoltage}'),
  category('PUSHBUTTON', 'Push Button', 'Industrial Push Button', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('operatorType', 'Operator Type', true),
    text('color', 'Color', true), text('contactConfiguration', 'Contact Configuration', true), text('diameter', 'Mounting Diameter'),
  ], '{operatorType} Push Button, {series} {model}, {color}, {contactConfiguration}'),
  category('LAMP', 'Indicator Lamp', 'Indicator Lamp', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('color', 'Color', true),
    text('supplyVoltage', 'Supply Voltage', true), text('lampType', 'Lamp Type'), text('diameter', 'Mounting Diameter'),
  ], '{color} {lampType} Indicator Lamp, {series} {model}, {supplyVoltage}'),
  category('LIMITSWITCH', 'Limit Switch', 'Industrial Limit Switch', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('actuatorType', 'Actuator Type', true),
    text('contactConfiguration', 'Contact Configuration', true), text('enclosureRating', 'Enclosure Rating'),
  ], '{description}, {series} {model}, {actuatorType}, {contactConfiguration}'),
  category('CT', 'CT', 'Current Transformer (CT)', [
    text('partNumber', 'Part Number', false), text('model', 'Model', false), text('ratio', 'CT Ratio', true), text('burden', 'Burden', true),
    text('accuracyClass', 'Accuracy Class', true), text('windowSize', 'Window Size'),
  ], '{description}, {model}, Ratio: {ratio}, Burden: {burden}, Class: {accuracyClass}'),
  category('PT', 'PT', 'Potential Transformer (PT)', [
    text('partNumber', 'Part Number', false), text('model', 'Model', false), text('ratio', 'Voltage Ratio', true), text('burden', 'Burden', true),
    text('accuracyClass', 'Accuracy Class', true), text('frequency', 'Frequency'),
  ], '{description}, {model}, Ratio: {ratio}, Burden: {burden}, Class: {accuracyClass}'),
  category('METER', 'Energy Meter', 'Energy Meter', [
    text('partNumber', 'Part Number', false), text('series', 'Series', false), text('model', 'Model', false), text('meterType', 'Meter Type', true),
    text('phase', 'Phase', true), text('currentInput', 'Current Input'), text('communication', 'Communication'),
  ], '{meterType} Meter, {series} {model}, {phase}'),
  category('TOOL', 'Tool', 'Industrial Tool', [
    text('partNumber', 'Part Number', false), text('toolType', 'Tool Type', true), text('model', 'Model', false), text('size', 'Size / Capacity', true),
    text('material', 'Material'), text('driveSize', 'Drive Size'),
  ], '{toolType}, {model}, Size: {size}'),
  category('CONSUMABLE', 'Consumable', 'Industrial Consumable', [
    text('partNumber', 'Part Number', false), text('consumableType', 'Consumable Type', true), text('model', 'Model / Grade', false), text('size', 'Size', true),
    text('packSize', 'Pack Size', true), text('shelfLife', 'Shelf Life'),
  ], '{consumableType}, {model}, Size: {size}, Pack: {packSize}'),
  category('FUSE', 'Fuse', 'Fuse / Fuse Link', [
    text('partNumber', 'Part Number', false),
    text('series', 'Series', false),
    text('model', 'Model / Size', false),
    text('fuseType', 'Fuse Type', true, ['DIAZED / Bottle Fuse', 'Cylindrical Fuse', 'NH Blade Fuse', 'Glass Fuse', 'HRC Fuse', 'Semiconductor Protection (Ultra-Fast)']),
    text('current', 'Current Rating', true, ['2A', '4A', '6A', '10A', '16A', '20A', '25A', '32A', '35A', '40A', '50A', '63A', '80A', '100A']),
    text('voltage', 'Voltage Rating', true, ['250V', '415V', '500V', '660V', '690V']),
    text('characteristic', 'Tripping Characteristic', false, ['gG/gL (General Purpose)', 'aM (Motor Protection)', 'gR/aR (Semiconductor Protection)', 'Quick-acting (FE)', 'Slow-acting']),
    text('standard', 'Standard / Compliance'),
  ], '{category}, {series} {model}, {current}, {voltage}, {characteristic}',
  '{codePrefix}-{manufacturerShort}-{series}-{current}-{voltage}'),
];

export const STORE_FIELDS: ProductFieldSchema[] = [
  { key: 'unit', label: 'Unit', type: 'select', options: ['Nos', 'pcs', 'm', 'kg', 'roll', 'set', 'box', 'lot'].map(value => ({ label: value, value })), validation: required, defaultValue: 'Nos', width: 'third' },
  { key: 'minimumStock', label: 'Minimum Stock', type: 'number', validation: { required: true, min: 0 }, defaultValue: '10', width: 'third' },
  { key: 'reorderLevel', label: 'Reorder Level', type: 'number', validation: { required: true, min: 0 }, defaultValue: '20', width: 'third' },
  { key: 'rack', label: 'Rack', type: 'text', validation: required, width: 'third' },
  { key: 'shelf', label: 'Shelf', type: 'text', validation: required, width: 'third' },
  { key: 'bin', label: 'Bin', type: 'text', width: 'third' },
  { key: 'warehouse', label: 'Warehouse', type: 'text', validation: required, defaultValue: 'Main Store', width: 'third' },
  { key: 'zone', label: 'Zone', type: 'text', width: 'third' },
  { key: 'remarks', label: 'Remarks', type: 'textarea', width: 'full', placeholder: 'Store-specific notes, handling instructions, or restrictions…' },
];

export const ADDITIONAL_FIELDS: ProductFieldSchema[] = [
  { key: 'supplier', label: 'Supplier', type: 'select', width: 'third' },
  { key: 'supplierPartNumber', label: 'Supplier Part Number', type: 'text', width: 'third' },
  { key: 'manufacturerPartNumber', label: 'Manufacturer Part Number', type: 'text', width: 'third' },
  { key: 'catalogNumber', label: 'Catalog Number', type: 'text', width: 'third' },
  { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g. 18 months', width: 'third' },
  { key: 'countryOfOrigin', label: 'Country Of Origin', type: 'text', width: 'third' },
  { key: 'datasheetUrl', label: 'Datasheet URL', type: 'url', placeholder: 'https://…', width: 'full' },
  { key: 'notes', label: 'Notes', type: 'textarea', width: 'full', placeholder: 'Additional commercial or technical information…' },
];

export const getCategorySchema = (id: string) =>
  PRODUCT_CATEGORY_SCHEMAS.find((schema) => schema.id === id) || PRODUCT_CATEGORY_SCHEMAS[0];

