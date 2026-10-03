export const en = {
  meta: {
    title: "Abody",
    description: "Digital products and services from Abody.",
  },
  header: {
    logoAlt: "Abody",
    cart: "Cart",
    // No plural forms: Arabic has several, so both languages use "items: N".
    cartLabel: (count: number) => `Cart, items: ${count}`,
  },
  product: {
    typeLabels: {
      DIGITAL_PRODUCT: "Digital product",
      SERVICE: "Service",
    },
    duration: "Duration",
    addToCart: "Add to Cart",
    adding: "Adding…",
    added: "Added to your cart.",
    alreadyInCart: "This service is already in your cart.",
    maxQuantity: "You already have the maximum quantity of this item in your cart.",
    viewCart: "View cart",
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
  cart: {
    title: "Your cart",
    breadcrumb: "Breadcrumb",
    home: "Home",
    itemCount: {
      zero: "{count} items",
      one: "{count} item",
      two: "{count} items",
      few: "{count} items",
      many: "{count} items",
      other: "{count} items",
    },
    emptyTitle: "Your cart is empty",
    emptyBody:
      "Add a product or a service and it will show up here, ready for checkout.",
    browseStore: "Browse the store",
    itemsRemoved: "Some items are no longer available and are not shown.",
    instantDownload: "Instant download",
    onboardingAfterPayment: "Onboarding form after payment",
    quantity: "Quantity",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    remove: "Remove",
    summary: "Order summary",
    subtotal: "Subtotal",
    total: "Total",
    checkout: "Continue to checkout",
    checkoutComingSoon: "Checkout is coming soon.",
    secureNote: "You pay on Stripe's secure page",
    errors: {
      invalid_input: "Enter a quantity from 1 to 99.",
      unavailable: "This item is no longer available.",
      cart_full: "Your cart is full. Remove an item to add another.",
      unexpected: "Something went wrong. Please try again.",
    },
  },
  notFound: {
    title: "Page not found",
    body: "The page you are looking for does not exist or has moved.",
    home: "Back to home",
  },
};

export type Dictionary = typeof en;
