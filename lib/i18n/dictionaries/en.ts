export const en = {
  meta: {
    title: "Abody",
    description: "Digital products and services from Abody.",
  },
  header: {
    logoAlt: "Abody",
  },
  product: {
    typeLabels: {
      DIGITAL_PRODUCT: "Digital product",
      SERVICE: "Service",
    },
    duration: "Duration",
    addToCart: "Add to Cart",
    cartComingSoon: "Cart is coming soon.",
    securePayment: "Secure payment powered by Stripe",
    description: "Description",
    included: "What's Included",
    requirements: "What we need from you",
    howItWorks: "How It Works",
    steps: {
      DIGITAL_PRODUCT: ["Purchase", "Receive access", "Download"],
      SERVICE: ["Purchase", "Tell us what we need", "We get started"],
    },
    related: "You might also like",
  },
  notFound: {
    title: "Page not found",
    body: "The page you are looking for does not exist or has moved.",
    home: "Back to home",
  },
};

export type Dictionary = typeof en;
