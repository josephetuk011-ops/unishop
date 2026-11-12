// Category-specific product details. Each family lists the fields a vendor fills in for that kind of product.
export type SpecField = { key: string; label: string; type: 'select' | 'number' | 'text'; options?: string[]; unit?: string; min?: number; max?: number; required?: boolean; help?: string };
export type SpecFamily = { id: string; title: string; fields: SpecField[] };

const condition: SpecField = { key: 'condition', label: 'Condition', type: 'select', options: ['Brand new', 'UK used', 'Nigerian used', 'Refurbished'], required: true };
const warranty: SpecField = { key: 'warranty', label: 'Warranty', type: 'select', options: ['None', '1 month', '3 months', '6 months', '1 year', '2 years'] };
const colour: SpecField = { key: 'colour', label: 'Colour', type: 'text' };
const gender: SpecField = { key: 'gender', label: 'For', type: 'select', options: ['Women', 'Men', 'Unisex', 'Girls', 'Boys', 'Babies'] };
const measurement = (key: string, label: string): SpecField => ({ key, label, type: 'number', unit: 'in', min: 1, max: 200 });

const phoneBrands = ['Apple', 'Samsung', 'Tecno', 'Infinix', 'itel', 'Xiaomi', 'Oppo', 'Realme', 'Vivo', 'Huawei', 'Nokia', 'Google Pixel', 'OnePlus', 'Motorola', 'Other'];
const laptopBrands = ['HP', 'Dell', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Microsoft', 'Toshiba', 'Samsung', 'Other'];
const storage = ['8 GB', '16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];
const ram = ['1 GB', '2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '24 GB', '32 GB', '64 GB'];

export const specFamilies: Record<string, SpecFamily> = {
  phone: { id: 'phone', title: 'Phone details', fields: [
    { key: 'brand', label: 'Brand', type: 'select', options: phoneBrands, required: true },
    { key: 'deviceType', label: 'Kind of device', type: 'select', options: ['Smartphone', 'Tablet', 'Feature phone', 'iPad', 'Foldable phone'], required: true },
    { key: 'model', label: 'Model', type: 'text', required: true, help: 'Example: Galaxy A15 or iPhone 13 Pro' },
    condition,
    { key: 'storage', label: 'Storage (space)', type: 'select', options: storage, required: true },
    { key: 'ram', label: 'RAM', type: 'select', options: ram },
    { key: 'battery', label: 'Battery', type: 'number', unit: 'mAh', min: 500, max: 30000 },
    { key: 'batteryLife', label: 'Battery life', type: 'text', help: 'Example: about 2 days of normal use' },
    { key: 'screen', label: 'Screen size', type: 'number', unit: 'inches', min: 1, max: 20 },
    { key: 'camera', label: 'Main camera', type: 'number', unit: 'MP', min: 1, max: 300 },
    { key: 'network', label: 'Network', type: 'select', options: ['3G', '4G LTE', '5G'] },
    { key: 'sim', label: 'SIM', type: 'select', options: ['Single SIM', 'Dual SIM', 'eSIM'] },
    colour, warranty
  ] },
  computer: { id: 'computer', title: 'Computer details', fields: [
    { key: 'brand', label: 'Brand', type: 'select', options: laptopBrands, required: true },
    { key: 'model', label: 'Model', type: 'text', required: true },
    condition,
    { key: 'processor', label: 'Processor', type: 'text', help: 'Example: Intel Core i5, 10th gen' },
    { key: 'ram', label: 'RAM', type: 'select', options: ram, required: true },
    { key: 'storage', label: 'Storage', type: 'select', options: storage, required: true },
    { key: 'storageType', label: 'Storage type', type: 'select', options: ['SSD', 'HDD', 'SSD and HDD'] },
    { key: 'screen', label: 'Screen size', type: 'number', unit: 'inches', min: 1, max: 40 },
    { key: 'batteryLife', label: 'Battery life', type: 'number', unit: 'hours', min: 1, max: 48 },
    colour, warranty
  ] },
  gadget: { id: 'gadget', title: 'Gadget details', fields: [
    { key: 'brand', label: 'Brand', type: 'text', required: true },
    { key: 'model', label: 'Model', type: 'text' },
    condition,
    { key: 'batteryLife', label: 'Battery life', type: 'number', unit: 'hours', min: 1, max: 1000 },
    { key: 'capacity', label: 'Battery capacity', type: 'number', unit: 'mAh', min: 100, max: 100000 },
    { key: 'connectivity', label: 'Connectivity', type: 'select', options: ['Wired', 'Bluetooth', 'Wi-Fi', 'Bluetooth and Wi-Fi', 'None'] },
    colour, warranty
  ] },
  clothing: { id: 'clothing', title: 'Clothing and measurements', fields: [
    gender,
    { key: 'style', label: 'Style', type: 'text', help: 'Example: senator, agbada, gown, ankara two-piece' },
    { key: 'material', label: 'Fabric or material', type: 'text', required: true, help: 'Example: cotton, lace, ankara, linen' },
    colour,
    { key: 'madeToMeasure', label: 'Sewing option', type: 'select', options: ['Ready to wear', 'Made to measure (customer sends measurements)', 'Both'], required: true },
    { key: 'sewingDays', label: 'Time to sew a custom order', type: 'number', unit: 'days', min: 1, max: 180 },
    measurement('chest', 'Chest or bust'), measurement('waist', 'Waist'), measurement('hip', 'Hip'), measurement('shoulder', 'Shoulder'),
    measurement('sleeve', 'Sleeve length'), measurement('length', 'Garment length'), measurement('inseam', 'Inseam (trousers)'),
    { key: 'care', label: 'Care', type: 'select', options: ['Machine wash', 'Hand wash', 'Dry clean only'] }
  ] },
  footwear: { id: 'footwear', title: 'Footwear details', fields: [
    gender,
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'material', label: 'Material', type: 'select', options: ['Leather', 'Suede', 'Canvas', 'Rubber', 'Synthetic', 'Other'] },
    colour,
    { key: 'footLength', label: 'Foot length it fits', type: 'number', unit: 'cm', min: 8, max: 40 }
  ] },
  fabric: { id: 'fabric', title: 'Fabric details', fields: [
    { key: 'material', label: 'Fabric type', type: 'text', required: true, help: 'Example: lace, ankara, aso-oke, damask' },
    { key: 'length', label: 'Length sold', type: 'number', unit: 'yards', min: 1, max: 500 },
    { key: 'width', label: 'Width', type: 'number', unit: 'in', min: 1, max: 120 },
    colour
  ] }
};

const phones = ['Phones and tablets'];
const computers = ['Laptops and computers'];
const gadgets = ['Phone accessories', 'Computer accessories', 'Headphones and audio', 'TVs and home entertainment', 'Cameras and drones', 'Gaming', 'Power banks, solar and batteries', 'Smart watches and gadgets'];
const clothing = ["Women's clothing", "Men's clothing", "Kids' clothing", 'Uniforms and workwear', 'Sportswear and gear'];
export const categoryFamily: Record<string, string> = {
  ...Object.fromEntries(phones.map((name) => [name, 'phone'])),
  ...Object.fromEntries(computers.map((name) => [name, 'computer'])),
  ...Object.fromEntries(gadgets.map((name) => [name, 'gadget'])),
  ...Object.fromEntries(clothing.map((name) => [name, 'clothing'])),
  'Shoes and sandals': 'footwear',
  'Fabrics and traditional wear': 'fabric'
};

export function specFamilyFor(category: string): SpecFamily | undefined {
  return specFamilies[categoryFamily[category]];
}

// Returns cleaned specs, or an error message. Unknown keys are dropped; blank values are skipped.
export function cleanSpecs(category: string, input: unknown): { specs?: Record<string, string | number>; error?: string } {
  const family = specFamilyFor(category);
  if (!family) return { specs: undefined };
  const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const specs: Record<string, string | number> = {};
  for (const field of family.fields) {
    const raw = source[field.key];
    const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (blank) {
      if (field.required) return { error: `${field.label} is required for ${category.toLowerCase()}.` };
      continue;
    }
    if (field.type === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < (field.min ?? 0) || value > (field.max ?? 1000000)) return { error: `${field.label} must be a number from ${field.min ?? 0} to ${field.max ?? 1000000}.` };
      specs[field.key] = value;
    } else if (field.type === 'select') {
      if (typeof raw !== 'string' || !field.options?.includes(raw)) return { error: `Choose a valid ${field.label.toLowerCase()}.` };
      specs[field.key] = raw;
    } else {
      if (typeof raw !== 'string' || raw.trim().length > 80) return { error: `${field.label} must be 80 characters or fewer.` };
      specs[field.key] = raw.trim();
    }
  }
  return { specs };
}
