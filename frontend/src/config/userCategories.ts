/**
 * Professional User Categories & Designations for Electrical / Switchgear Company.
 * Easily configurable via backend/user_categories.json and /api/config/user-categories.
 */

export interface UserCategoryInfo {
  category: string;
  department: string;
  description: string;
  access_level: 'Administrator' | 'Store Manager' | 'Store Operator' | 'Purchase Team' | 'Employee';
}

export const DEFAULT_USER_CATEGORIES: UserCategoryInfo[] = [
  {
    category: "Testing Engineer",
    department: "Quality & Testing",
    description: "Performs routine, functional, HV, insulation, dielectric, and FAT/SAT testing on control panels.",
    access_level: "Employee"
  },
  {
    category: "Mechanical Designer",
    department: "Mechanical Engineering",
    description: "Designs 3D enclosure structures, sheet metal fabrication drawings, busbar clearances, and GA layouts.",
    access_level: "Employee"
  },
  {
    category: "Electrical Designer",
    department: "Electrical Engineering",
    description: "Prepares electrical schematics, SLD diagrams, control circuit layouts, terminal charts, and BOM specifications.",
    access_level: "Employee"
  },
  {
    category: "Development Engineer",
    department: "R&D / Systems",
    description: "Develops embedded systems, firmware, custom electronics, communication gateways, and IoT modules.",
    access_level: "Employee"
  },
  {
    category: "Electrician",
    department: "Production & Assembly",
    description: "Executes main power cabling, busbar assembly, MCCB/switchgear installation, and physical terminations.",
    access_level: "Employee"
  },
  {
    category: "Automation / PLC Programmer",
    department: "Automation & Controls",
    description: "Programs PLCs, HMIs, SCADA systems, VFD drives, and field communication networks (Modbus, Profinet).",
    access_level: "Employee"
  },
  {
    category: "Commissioning Engineer",
    department: "Field & Site Services",
    description: "Conducts on-site panel installation, energization, site acceptance testing (SAT), and client handover.",
    access_level: "Employee"
  },
  {
    category: "Quality Assurance (QA/QC) Engineer",
    department: "Quality Assurance",
    description: "Maintains ISO standards, inspects incoming raw materials, audits panel assembly, and signs test certs.",
    access_level: "Employee"
  },
  {
    category: "HR",
    department: "Human Resources",
    description: "Manages human resource operations, employee onboarding, attendance, safety compliance, and records.",
    access_level: "Employee"
  },
  {
    category: "Project Manager",
    department: "Project Management",
    description: "Coordinates project scheduling, resource allocation, customer milestone delivery, and tracking.",
    access_level: "Employee"
  },
  {
    category: "Store Manager",
    department: "Store & Warehouse",
    description: "Oversees inventory stock levels, warehouse bins, goods receipts, and warehouse logistics.",
    access_level: "Store Manager"
  },
  {
    category: "Store Operator",
    department: "Store & Warehouse",
    description: "Handles daily stock-in, material issue for BOMs, physical transfers, and inventory counts.",
    access_level: "Store Operator"
  },
  {
    category: "Purchase Team",
    department: "Procurement",
    description: "Manages supplier RFQs, purchase orders, component procurement, and vendor relations.",
    access_level: "Purchase Team"
  },
  {
    category: "Administrator",
    department: "Management",
    description: "Full system administrator access to all modules, users, configurations, and settings.",
    access_level: "Administrator"
  }
];

export const getCategoryBadgeStyle = (category?: string): { bg: string; text: string; border: string } => {
  if (!category) return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

  const catLower = category.toLowerCase();

  if (catLower.includes('admin')) {
    return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  }
  if (catLower.includes('manager')) {
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
  }
  if (catLower.includes('testing') || catLower.includes('qa') || catLower.includes('qc')) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }
  if (catLower.includes('electrical') || catLower.includes('power')) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  }
  if (catLower.includes('mechanical')) {
    return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  }
  if (catLower.includes('electrician') || catLower.includes('wiring')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  if (catLower.includes('development') || catLower.includes('automation') || catLower.includes('plc')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
  }
  if (catLower.includes('hr')) {
    return { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' };
  }
  if (catLower.includes('purchase')) {
    return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' };
  }
  if (catLower.includes('store')) {
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
  }

  return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
};
