// Service categories for providers. A provider's `niche` is one service name from this list;
// the same service name can sit in more than one group (for example Photographers).
export const serviceCategories: { name: string; services: string[] }[] = [
  { name: 'Home Services', services: ['Plumbing services', 'Electrical services', 'House cleaning', 'Laundry and ironing', 'Painting', 'Carpentry', 'Furniture repairs', 'Air conditioner installation and repairs', 'Generator repairs', 'Pest control and fumigation', 'Gardening and landscaping', 'Home maintenance', 'Interior decoration'] },
  { name: 'Beauty and Personal Care', services: ['Hair stylists and hairdressers', 'Barbers', 'Makeup artists', 'Nail technicians', 'Massage therapists', 'Pedicure and manicure', 'Hair braiding and weaving', 'Wig installation', 'Skincare specialists', 'Spa services'] },
  { name: 'Transportation and Mobility', services: ['Car hire and rentals', 'Taxi and private drivers', 'Chauffeur services', 'Airport pickup and drop-off', 'Motorcycle transportation', 'Bus and travel booking', 'Vehicle towing', 'Car washing and detailing'] },
  { name: 'Logistics and Delivery', services: ['Dispatch riders', 'Package delivery', 'Food delivery', 'Grocery delivery', 'Courier services', 'Moving and relocation services', 'Truck and van rentals', 'Errand services'] },
  { name: 'Travel and Accommodation', services: ['Flight booking agents', 'Hotel reservations', 'Apartment reservations', 'Short-let apartments', 'Tour operators', 'Travel consultants', 'Visa assistance', 'Car rental services', 'Holiday and vacation packages'] },
  { name: 'Events and Entertainment', services: ['Event planners', 'Caterers', 'DJs', 'MCs and comedians', 'Photographers', 'Videographers', 'Event decorators', 'Bakers and cake designers', 'Live bands and musicians', 'Event ushers', 'Sound and lighting technicians', 'Event equipment rentals'] },
  { name: 'Food and Catering', services: ['Private chefs', 'Home cooks', 'Outdoor catering', 'Small chops vendors', 'Pastry chefs', 'Cake bakers', 'Restaurant reservations', 'Food vendors', 'Bartenders and professional servers'] },
  { name: 'Education and Training', services: ['Private tutors', 'Home lesson teachers', 'Music teachers', 'Language tutors', 'Computer trainers', 'Professional skills trainers', 'Driving instructors', 'Examination preparation tutors', 'Online course instructors'] },
  { name: 'Health and Wellness', services: ['Home nurses', 'Caregivers', 'Physiotherapists', 'Nutritionists', 'Fitness trainers', 'Yoga instructors', 'Wellness consultants', 'Home healthcare providers'] },
  { name: 'Professional and Business Services', services: ['Lawyers and legal consultants', 'Accountants', 'Tax consultants', 'Business consultants', 'Human resource consultants', 'Digital marketers', 'Business registration agents', 'Insurance agents', 'Financial consultants', 'Virtual assistants'] },
  { name: 'Technology and Digital Services', services: ['Website developers', 'Mobile app developers', 'Graphic designers', 'Software developers', 'Computer technicians', 'Phone repair technicians', 'Data recovery specialists', 'IT support specialists', 'Social media managers', 'Content creators', 'Video editors', 'Cybersecurity professionals'] },
  { name: 'Fashion and Tailoring', services: ['Fashion designers', 'Tailors', 'Clothing alteration specialists', 'Fashion stylists', 'Shoe designers', 'Shoe repairers', 'Laundry and dry-cleaning specialists', 'Fashion consultants'] },
  { name: 'Automotive Services', services: ['Auto mechanics', 'Auto electricians', 'Car painters', 'Vulcanizers', 'Car wash operators', 'Battery technicians', 'Car AC technicians', 'Vehicle inspection services', 'Auto spare-parts installation'] },
  { name: 'Construction and Engineering', services: ['Building contractors', 'Architects', 'Civil engineers', 'Structural engineers', 'Electricians', 'Plumbers', 'Welders', 'Tilers', 'Bricklayers', 'Roofers', 'POP installers', 'Aluminium fabricators', 'Borehole drilling services', 'Solar installation technicians'] },
  { name: 'Security Services', services: ['Private security guards', 'CCTV installation', 'Security system maintenance', 'Event security', 'Bodyguard services', 'Alarm system installation'] },
  { name: 'Childcare and Domestic Assistance', services: ['Babysitters', 'Nannies', 'Housekeepers', 'Domestic workers', 'Elderly caregivers', 'Home cooks', 'Personal assistants', 'Home attendants'] },
  { name: 'Real Estate and Property Services', services: ['Real estate agents', 'Property managers', 'House rental agents', 'Property inspection services', 'Property valuation', 'Facility management', 'Property maintenance'] },
  { name: 'Creative and Media Services', services: ['Graphic artists', 'Photographers', 'Videographers', 'Animators', 'Voice-over artists', 'Content writers', 'Copywriters', 'Printing services', 'Branding specialists', 'Social media content creators'] },
  { name: 'Agriculture and Outdoor Services', services: ['Farm consultants', 'Farm equipment operators', 'Landscaping', 'Gardening', 'Agricultural machinery rentals', 'Poultry services', 'Livestock care', 'Agricultural produce transportation'] },
  { name: 'Pet Care Services', services: ['Veterinary services', 'Pet grooming', 'Pet sitting', 'Pet boarding', 'Pet training', 'Pet transportation'] },
  { name: 'Other Convenient Services', services: ['Personal shopping', 'Gift delivery', 'Dry cleaning', 'Document processing', 'Printing and photocopying', 'Notary services', 'Appliance installation', 'Appliance repairs', 'Utility-related assistance'] }
];

export const serviceNicheNames: string[] = [...new Set(serviceCategories.flatMap((group) => group.services))];

// The 21 niches providers used before the grouped list; existing accounts and listings are moved to these names.
export const legacyNicheMap: Record<string, string> = {
  'Barbing': 'Barbers', 'Cleaning': 'House cleaning', 'Cooking': 'Home cooks', 'Hair dressing': 'Hair stylists and hairdressers',
  'Decorating': 'Interior decoration', 'Grass clearing': 'Gardening and landscaping', 'Mechanic': 'Auto mechanics', 'Electrician': 'Electrical services',
  'Plumber': 'Plumbing services', 'Photographer': 'Photographers', 'Makeup': 'Makeup artists', 'Fashion designing': 'Fashion designers',
  'Manicure and pedicure': 'Pedicure and manicure', 'Therapist': 'Massage therapists', 'Graphic design': 'Graphic designers',
  'Dry cleaning': 'Dry cleaning', 'Laundry and ironing': 'Laundry and ironing', 'Phone repair': 'Phone repair technicians',
  'Event planning': 'Event planners', 'Web and app design': 'Website developers', 'Tutoring': 'Private tutors'
};
export const currentNiche = (niche: unknown) => (typeof niche === 'string' ? legacyNicheMap[niche] || niche : '');
