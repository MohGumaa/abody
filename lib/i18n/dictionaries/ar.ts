import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export const ar: Dictionary = {
  meta: {
    title: "عبودي",
    description: "منتجات وخدمات رقمية من عبودي.",
  },
  header: {
    logoAlt: "عبودي",
  },
  product: {
    typeLabels: {
      DIGITAL_PRODUCT: "منتج رقمي",
      SERVICE: "خدمة",
    },
    duration: "المدة",
    addToCart: "أضف إلى السلة",
    cartComingSoon: "السلة ستتوفر قريباً.",
    securePayment: "دفع آمن عبر Stripe",
    description: "الوصف",
    included: "ماذا يتضمن",
    requirements: "ما نحتاجه منك",
    howItWorks: "كيف تعمل المنصة",
    steps: {
      DIGITAL_PRODUCT: ["اشترِ", "احصل على الوصول", "تحميل"],
      SERVICE: ["اشترِ", "أخبرنا بما نحتاجه", "نبدأ العمل"],
    },
    related: "قد يعجبك أيضاً",
  },
  notFound: {
    title: "الصفحة غير موجودة",
    body: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    home: "العودة إلى الرئيسية",
  },
};
