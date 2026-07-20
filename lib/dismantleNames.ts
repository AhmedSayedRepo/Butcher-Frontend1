// v2 replan follow-up (i18n completeness): DismantleTemplate/DismantleTemplateCut
// names come from seeded DB rows (backend/prisma/seed.ts), not app-chrome
// strings — they can't go through react-i18next's normal t() keys the way
// static UI labels do. Since the vocabulary is fixed (12 templates, ~38
// distinct cut names across calf/sheep/goat — see the seed data), a static
// lookup table translated once is simpler than adding bilingual columns to
// the schema for content that never changes at runtime. Falls back to the
// original English string for anything not in the map, so a future new
// template/cut still renders (untranslated) instead of disappearing.
export const ANIMAL_TYPE_AR: Record<string, string> = {
  calf: 'عجل',
  sheep: 'غنم',
  goat: 'ماعز'
}

export const TEMPLATE_NAME_AR: Record<string, string> = {
  'Foresaddle / Hindsaddle Split': 'تقسيم النصف الأمامي / النصف الخلفي',
  'Nose-to-Tail (minimal waste)': 'من الأنف إلى الذيل (أقل هدر)',
  'Retail Sub-Primal': 'التقطيع الفرعي للبيع بالتجزئة',
  'Standard 5-Primal (USDA)': 'التقطيع الأساسي الخماسي (USDA)',
  'Forequarter / Hindquarter Split': 'تقسيم الربع الأمامي / الربع الخلفي',
  'Nose-to-Tail (Goat)': 'من الأنف إلى الذيل (ماعز)',
  'Retail Sub-Primal (Goat)': 'التقطيع الفرعي للبيع بالتجزئة (ماعز)',
  'Standard Primal (Goat)': 'التقطيع الأساسي (ماعز)',
  'Nose-to-Tail (Lamb)': 'من الأنف إلى الذيل (غنم)',
  'Retail Sub-Primal (Lamb)': 'التقطيع الفرعي للبيع بالتجزئة (غنم)',
  'Standard Primal (Lamb)': 'التقطيع الأساسي (غنم)'
}

export const CUT_NAME_AR: Record<string, string> = {
  Foresaddle: 'النصف الأمامي',
  Hindsaddle: 'النصف الخلفي',
  Offal: 'الأحشاء',
  'Bones (for stock)': 'عظام (لتحضير المرق)',
  'Foreshank & Breast (riblets / shank)': 'الساق الأمامية والصدر (أضلاع صغيرة / ساق)',
  Kidneys: 'الكلى',
  'Leg (cutlets/scallopini / roast / osso buco shank)': 'الفخذ (شرحات / روست / ساق أوسو بوكو)',
  Liver: 'الكبد',
  'Loin (chops / tenderloin)': 'المتن (تشوب / فيليه)',
  'Rib (chops / rack roast)': 'الأضلاع (تشوب / روست)',
  'Shoulder (chops / roast / stew meat)': 'الكتف (تشوب / روست / لحم يخنة)',
  Sweetbreads: 'الغدة الزعترية',
  'Trim (for ground veal)': 'قصاصات (للحم العجل المفروم)',
  'Foreshank & Breast': 'الساق الأمامية والصدر',
  Leg: 'الفخذ',
  Loin: 'المتن',
  'Rib (Hotel Rack)': 'الأضلاع (ريب رول)',
  Shoulder: 'الكتف',
  'Forequarter (shoulder, neck, foreshank, rack, breast)': 'الربع الأمامي (كتف، رقبة، ساق أمامية، أضلاع، صدر)',
  'Hindquarter (loin, leg, hind shank, flank)': 'الربع الخلفي (متن، فخذ، ساق خلفية، خاصرة)',
  'Bones (goat bone soup)': 'عظام (لشوربة عظام الماعز)',
  Heart: 'القلب',
  'Leg (roast / steaks / curry cutting)': 'الفخذ (روست / ستيك / تقطيع كاري)',
  'Loin, Breast, Neck & Flank (grouped)': 'المتن والصدر والرقبة والخاصرة (مجمعة)',
  'Rack (goat chops / rack)': 'الأضلاع (تشوب ماعز / ريب رول)',
  'Shoulder (curry-cut pieces / roast)': 'الكتف (قطع كاري / روست)',
  'Trim (for ground goat)': 'قصاصات (للحم الماعز المفروم)',
  Tripe: 'الكرشة',
  'Rack/Rib': 'الأضلاع',
  'Breast & Foreshank (riblets / breast rolls)': 'الصدر والساق الأمامية (أضلاع صغيرة / لفائف صدر)',
  'Leg (roast / steaks / butterflied)': 'الفخذ (روست / ستيك / مفتوح كالفراشة)',
  'Loin (chops / saddle)': 'المتن (تشوب / سادل)',
  'Neck (osso-buco style)': 'الرقبة (على طريقة أوسو بوكو)',
  'Rack (rib chops / rack roast / crown roast)': 'الأضلاع (تشوب أضلاع / ريب رول / كراون روست)',
  Shank: 'الساق',
  'Shoulder (chops / roast)': 'الكتف (تشوب / روست)',
  'Trim (for ground lamb/merguez)': 'قصاصات (للحم الغنم المفروم / المرقاز)',
  'Breast & Foreshank': 'الصدر والساق الأمامية'
}

export function localizedName(en: string, lang: string, dict: Record<string, string>): string {
  return lang === 'ar' ? (dict[en] ?? en) : en
}
