// Category-specific product details. Each family lists the fields a vendor fills in for that kind of product.
export type SpecField = { key: string; label: string; type: 'select' | 'number' | 'text'; options?: string[]; unit?: string; min?: number; max?: number; required?: boolean; help?: string };
export type SpecFamily = { id: string; title: string; fields: SpecField[] };

const condition: SpecField = { key: 'condition', label: 'Condition', type: 'select', options: ['Brand new', 'UK used', 'Nigerian used', 'Open box', 'Refurbished', 'Thrift'], required: true };
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
    { key: 'batteryHealth', label: 'Battery health', type: 'number', unit: '%', min: 1, max: 100, help: 'For phones. Check in Settings.' },
    { key: 'biometrics', label: 'Face ID or fingerprint', type: 'select', options: ['All working', 'Some not working', 'Not available'] },
    { key: 'accessories', label: 'Accessories included', type: 'text', help: 'Example: charger, earpiece, case' },
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
    { key: 'graphics', label: 'Graphics', type: 'select', options: ['Integrated', 'Dedicated'] },
    { key: 'keyboardLight', label: 'Keyboard light', type: 'select', options: ['Yes', 'No'] },
    { key: 'charger', label: 'Charger', type: 'select', options: ['Original charger', 'Follow-come charger', 'No charger'] },
    { key: 'usedMonths', label: 'Months used', type: 'number', unit: 'months', min: 0, max: 240 },
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
    { key: 'care', label: 'Care', type: 'select', options: ['Machine wash', 'Hand wash', 'Dry clean only'] },
    { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free size'] },
    { key: 'fit', label: 'Fit', type: 'select', options: ['Slim fit', 'Regular fit', 'Oversized', 'Bodycon', 'A-line', 'Free size'] },
    { key: 'stretchy', label: 'Stretchy', type: 'select', options: ['Yes', 'No'] },
    { key: 'transparent', label: 'Transparent', type: 'select', options: ['Yes', 'No'] },
    { key: 'lined', label: 'Lined', type: 'select', options: ['Yes', 'No'] },
    { key: 'setType', label: 'Set or single', type: 'select', options: ['Top only', 'Top and trouser', 'Full set', 'Single piece'] },
    { key: 'occasion', label: 'Occasion', type: 'select', options: ['Casual', 'Office', 'Party', 'Church', 'Wedding guest', 'Streetwear'] },
    { key: 'modelInfo', label: 'Model info', type: 'text', help: "Example: model is 5'7 wearing size M" }
  ] },
  footwear: { id: 'footwear', title: 'Footwear details', fields: [
    gender,
    { key: 'footType', label: 'Type', type: 'select', options: ['Sneakers', 'Heels', 'Loafers', 'Sandals', 'Boots', 'Slippers'] },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'material', label: 'Material', type: 'select', options: ['Leather', 'Suede', 'Canvas', 'Rubber', 'Mesh', 'Synthetic', 'Other'] },
    colour,
    { key: 'ukSize', label: 'UK size', type: 'select', options: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
    { key: 'euSize', label: 'EU size', type: 'text' },
    { key: 'usSize', label: 'US size', type: 'text' },
    { key: 'footLength', label: 'Foot length it fits', type: 'number', unit: 'cm', min: 8, max: 40 },
    { key: 'fit', label: 'Fit', type: 'select', options: ['Runs small', 'True to size', 'Runs big'] },
    { key: 'wideFeet', label: 'Wide feet friendly', type: 'select', options: ['Yes', 'No'] },
    { key: 'heelHeight', label: 'Heel height', type: 'select', options: ['Flat', '2 inches', '3 inches', '4 inches', 'Higher'] },
    { key: 'sole', label: 'Sole', type: 'select', options: ['Rubber', 'Foam', 'Leather', 'Other'] },
    { key: 'hasBox', label: 'Comes with box', type: 'select', options: ['Yes', 'No'] }
  ] },
  wig: { id: 'wig', title: 'Wig and hair details', fields: [
    { key: 'hairType', label: 'Hair type', type: 'select', options: ['100% human hair', 'Synthetic', 'Blend'], required: true },
    { key: 'style', label: 'Style', type: 'text', help: 'Example: bone straight, body wave, curly, pixie cut, bob' },
    { key: 'wigLength', label: 'Length', type: 'number', unit: 'in', min: 1, max: 60 },
    { key: 'density', label: 'Density', type: 'select', options: ['130%', '150%', '180%', '200%', '250%'] },
    { key: 'lace', label: 'Lace type', type: 'select', options: ['13x4 frontal', '13x6 frontal', '4x4 closure', '5x5 closure', '2x6 closure', 'No lace'] },
    { key: 'capSize', label: 'Cap size', type: 'select', options: ['Small', 'Medium', 'Large'] },
    { key: 'strap', label: 'Adjustable strap', type: 'select', options: ['Yes', 'No'] },
    { key: 'dyeable', label: 'Can be dyed or bleached', type: 'select', options: ['Yes', 'No', 'Dye only'] },
    { key: 'shedding', label: 'Shedding or tangling', type: 'select', options: ['No shedding', 'Minimal'] },
    { key: 'comesWith', label: 'Comes with', type: 'text', help: 'Example: wig cap, lashes' },
    colour
  ] },
  bag: { id: 'bag', title: 'Bag details', fields: [
    { key: 'bagType', label: 'Type', type: 'select', options: ['Handbag', 'Backpack', 'Crossbody', 'Tote', 'Clutch', 'Travel bag', 'Suitcase'], required: true },
    { key: 'dimensions', label: 'Size (L x W x H in cm)', type: 'text', help: 'Example: 30 x 12 x 22' },
    { key: 'laptop', label: 'Can carry laptop', type: 'select', options: ['13 inch', '14 inch', '15 inch', 'No'] },
    { key: 'bagMaterial', label: 'Material', type: 'select', options: ['Real leather', 'PU leather (faux)', 'Canvas', 'Fabric', 'Croc'] },
    { key: 'compartments', label: 'Compartments', type: 'text', help: 'Example: 1 main, 2 inner, 1 zipper' },
    { key: 'closure', label: 'Closure', type: 'select', options: ['Zip', 'Magnetic', 'Buckle', 'Drawstring', 'Open'] },
    { key: 'strap', label: 'Strap adjustable', type: 'select', options: ['Yes', 'No'] },
    { key: 'bagWeight', label: 'Weight', type: 'select', options: ['Very light', 'Medium', 'Heavy'] },
    colour
  ] },
  perfume: { id: 'perfume', title: 'Perfume details', fields: [
    { key: 'brand', label: 'Brand', type: 'text', required: true },
    { key: 'fragrance', label: 'Name', type: 'text', required: true, help: 'Example: Sauvage Elixir' },
    { key: 'sizeMl', label: 'Size', type: 'number', unit: 'ml', min: 1, max: 2000 },
    { key: 'perfumeType', label: 'Type', type: 'select', options: ['Eau de parfum', 'Eau de toilette', 'Oil', 'Body mist'] },
    gender,
    { key: 'longevity', label: 'Longevity', type: 'select', options: ['About 4 hours', 'About 8 hours', '12 hours or more', 'All day'] },
    { key: 'projection', label: 'Projection', type: 'select', options: ['Soft', 'Moderate', 'Strong'] },
    { key: 'notes', label: 'Notes', type: 'text', help: 'Example: bergamot, lavender, vanilla' },
    { key: 'authenticity', label: 'Original or inspired', type: 'select', options: ['Original', 'Designer inspired'], required: true, help: 'Be honest. Customers see this.' },
    { key: 'sealed', label: 'Sealed', type: 'select', options: ['Yes', 'No'] }
  ] },
  jewelry: { id: 'jewelry', title: 'Jewelry details', fields: [
    { key: 'jewelryType', label: 'Type', type: 'select', options: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Watch', 'Anklet', 'Set'], required: true },
    { key: 'jewelryMaterial', label: 'Material', type: 'select', options: ['Gold plated', 'Silver', 'Stainless steel', '925 silver', 'Real gold 18k', 'Cubic zirconia', 'Beads'] },
    { key: 'tarnish', label: 'Will it fade or tarnish', type: 'select', options: ['No tarnish', 'May fade after some months'], help: 'Be honest. Customers see this.' },
    { key: 'waterproof', label: 'Safe in water', type: 'select', options: ['Yes', 'No'] },
    { key: 'hypoallergenic', label: 'Hypoallergenic', type: 'select', options: ['Yes', 'No'] },
    { key: 'jewelrySize', label: 'Size', type: 'text', help: 'Example: ring size 7, necklace 18 inches' },
    { key: 'hasBox', label: 'Comes with box', type: 'select', options: ['Yes', 'No'] },
    colour, warranty
  ] },
  fabric: { id: 'fabric', title: 'Fabric details', fields: [
    { key: 'material', label: 'Fabric type', type: 'text', required: true, help: 'Example: lace, ankara, aso-oke, damask' },
    { key: 'length', label: 'Length sold', type: 'number', unit: 'yards', min: 1, max: 500 },
    { key: 'width', label: 'Width', type: 'number', unit: 'in', min: 1, max: 120 },
    colour
  ] }
};

// Fields every product can carry. Added to each family; products in other categories get them alone.
const generalFields: SpecField[] = [
  { key: 'deliveryTime', label: 'Delivery time', type: 'select', options: ['Same day', '1 to 2 days', '2 to 3 days nationwide', 'Made to order'] },
  { key: 'returnPolicy', label: 'Warranty or return', type: 'text', help: 'Example: 7 days warranty, or no return on wigs' },
  { key: 'inBox', label: "What's in the box", type: 'text', help: 'Example: charger and case' }
];
for (const family of Object.values(specFamilies)) {
  if (!family.fields.some((f) => f.key === 'condition') && family.id !== 'fabric') family.fields.push({ ...condition, required: false });
  family.fields.push(...generalFields);
}
specFamilies.general = { id: 'general', title: 'Product details', fields: [{ ...condition, required: false }, ...generalFields] };

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
  'Hair, wigs and extensions': 'wig',
  'Bags and luggage': 'bag',
  'Perfumes and fragrances': 'perfume',
  'Jewelry and watches': 'jewelry',
  'Fabrics and traditional wear': 'fabric'
};

export function specFamilyFor(category: string): SpecFamily | undefined {
  return specFamilies[categoryFamily[category] || 'general'];
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
