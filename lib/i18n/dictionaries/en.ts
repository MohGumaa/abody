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
    nav: "Main navigation",
    home: "Home",
    products: "Products",
    services: "Services",
    trust: {
      download: "Instant download after payment",
      payment: "Secure payment with Stripe",
      tracking: "Track every service from your account",
    },
  },
  footer: {
    blurb:
      "Digital products you can download today and services run by the Abody team.",
    rights: (year: number) => `© ${year} Abody. All rights reserved.`,
    stripe: "Payments secured by Stripe",
    shop: "Shop",
  },
  product: {
    typeLabels: {
      DIGITAL_PRODUCT: "Digital product",
      SERVICE: "Service",
    },
    duration: "Duration",
    addToCart: "Add to cart",
    adding: "Adding…",
    added: "Added to your cart.",
    alreadyInCart: "This service is already in your cart.",
    maxQuantity: "You already have the maximum quantity of this item in your cart.",
    viewCart: "View cart",
    securePayment: "Secure payment powered by Stripe",
    description: "Description",
    included: "What's included",
    requirements: "What we need from you",
    howItWorks: "How it works",
    steps: {
      DIGITAL_PRODUCT: ["Purchase", "Receive access", "Download"],
      SERVICE: ["Purchase", "Tell us what we need", "We get started"],
    },
    related: "You might also like",
    viewAll: "View all",
    instantDownload: "Instant download",
    startsAfterOnboarding: "Starts after onboarding",
    keptInAccount: "Kept in your account",
    statusUpdates: "Status updates in your account",
    purchase: "Purchase",
    price: "Price",
    delivery: "Delivery",
    access: "Access",
    fromAccount: "From your account",
    afterYouBuy: "After you buy",
    afterYouBuySteps: [
      "The download appears on your order confirmation page.",
      "It stays available under Downloads in your account.",
      "You get a receipt by email.",
    ],
  },
  listing: {
    catalogType: "Catalog type",
    categories: "Categories",
    categoryEmpty: "Nothing in this category right now.",
    types: {
      DIGITAL_PRODUCT: {
        title: "Products",
        intro:
          "Templates, guides, and resources you can download as soon as your payment is confirmed.",
        tab: "Digital products",
        all: "All products",
        empty: "No products yet. Check back soon.",
        count: {
          zero: "{count} products",
          one: "{count} product",
          two: "{count} products",
          few: "{count} products",
          many: "{count} products",
          other: "{count} products",
        },
      },
      SERVICE: {
        title: "Services",
        intro:
          "Services run by the Abody team, from ad campaigns to account management. Work starts once we have your details.",
        tab: "Services",
        all: "All services",
        empty: "No services yet. Check back soon.",
        count: {
          zero: "{count} services",
          one: "{count} service",
          two: "{count} services",
          few: "{count} services",
          many: "{count} services",
          other: "{count} services",
        },
      },
    },
  },
  home: {
    hero: {
      eyebrow: "Digital products and services",
      title: "Marketing tools and done-for-you services",
      lead: "Download templates and guides the moment you pay, or hand your ads to the Abody team and follow the work from your account.",
      browseProducts: "Browse products",
      exploreServices: "Explore services",
    },
    categories: "Shop by category",
    viewAll: "View all",
    featured: {
      title: "Featured products",
      intro: "Ready to use the minute your payment clears.",
    },
    services: {
      title: "Services",
      intro: "Buy online, tell us what we need, and we get started.",
      viewAll: "View all services",
      promoEyebrow: "Done for you",
      promoTitle: "Hand it to the Abody team",
      promoBody:
        "Every service comes with a clear scope, a fixed price, and status updates in your account.",
      promoAction: "See how services work",
    },
    why: "Why Abody",
    values: {
      instant: {
        title: "Delivered instantly",
        body: "Your files are ready in your account as soon as the payment is confirmed.",
      },
      secure: {
        title: "Secure payment",
        body: "Checkout runs on Stripe. Abody never sees or stores your card details.",
      },
      people: {
        title: "Real people on your services",
        body: "The Abody team does the work and keeps the status up to date.",
      },
    },
    howItWorks: "How it works",
    steps: [
      {
        title: "Discover",
        body: "Browse products and services and pick what fits.",
      },
      { title: "Purchase", body: "Pay securely with Stripe in a few clicks." },
      {
        title: "Receive",
        body: "Download your files or fill in the service brief.",
      },
      {
        title: "Manage",
        body: "Find orders, downloads, and services in your account.",
      },
    ],
    cta: {
      title: "Ready to grow your business?",
      body: "Start with a template today, or let us run the campaign for you.",
      action: "Browse the store",
    },
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
    redirecting: "Redirecting to Stripe…",
    checkoutCancelled: "Checkout cancelled. Your cart is saved.",
    secureNote: "You pay on Stripe's secure page",
    checkoutErrors: {
      empty_cart:
        "The items in your cart are no longer available. Refresh the page to see your cart.",
      unexpected: "Checkout could not start. Please try again.",
    },
    errors: {
      invalid_input: "Enter a quantity from 1 to 99.",
      unavailable: "This item is no longer available.",
      cart_full: "Your cart is full. Remove an item to add another.",
      unexpected: "Something went wrong. Please try again.",
    },
  },
  checkoutResult: {
    total: "Total paid",
    keepShopping: "Keep shopping",
    viewServices: "Browse services",
    backToCart: "Back to your cart",
    orderNumber: "Order",
    downloads: {
      title: "Your downloads",
      download: "Download",
      keepLink:
        "Keep the link to this page to download your files again later.",
      pending:
        "Your downloads will appear here in a moment. Refresh the page to check.",
    },
    paid: {
      title: "Payment received",
      body: "Thank you for your purchase. We are confirming your order now.",
      confirmedBody: "Thank you for your purchase. Your order is confirmed.",
    },
    processing: {
      title: "Your payment is processing",
      body: "Stripe is still confirming your payment. This can take a little while for some payment methods.",
    },
    not_completed: {
      title: "Payment not completed",
      body: "You were not charged. Your cart is still saved, so you can try again.",
    },
  },
  notFound: {
    title: "Page not found",
    body: "The page you are looking for does not exist or has moved.",
    home: "Back to home",
  },
};

export type Dictionary = typeof en;
