import { NextResponse, type NextRequest } from "next/server";
import { CART_COOKIE } from "@/lib/cart";
import { isCheckoutSessionId } from "@/lib/checkout";
import { isLocale, localizedPath } from "@/lib/i18n/config";
import { getStripe, isMissingResource } from "@/lib/stripe";

// Stripe's success_url. Clearing a cookie needs a route handler; the success
// page then shows the session state.
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[lang]/checkout/return">,
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new NextResponse(null, { status: 404 });

  const toCart = NextResponse.redirect(
    new URL(localizedPath(lang, "/cart"), request.url),
    303,
  );
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!isCheckoutSessionId(sessionId)) return toCart;

  let status: string | null;
  try {
    ({ status } = await getStripe().checkout.sessions.retrieve(sessionId));
  } catch (error) {
    if (isMissingResource(error)) return toCart;
    throw error;
  }

  const success = new URL(localizedPath(lang, "/success"), request.url);
  success.searchParams.set("session_id", sessionId);
  const response = NextResponse.redirect(success, 303);
  // A cancelled, open, or expired session leaves the cart as it was.
  if (status === "complete") response.cookies.delete(CART_COOKIE);
  return response;
}
