// A fake Stripe API for the browser tests (feature 25a). The app reaches it
// through STRIPE_API_BASE. It implements only the calls the app makes, plus a
// stand-in for the hosted Checkout page whose Pay button sends the signed
// checkout.session.completed webhook, as Stripe does. Sessions live in memory.
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import Stripe from "stripe";

// Must match the app web server's env in playwright.config.ts.
const PORT = 12111;
const APP_URL = "http://localhost:3100";
const WEBHOOK_SECRET = "whsec_e2e";
const BASE = `http://localhost:${PORT}`;

const signer = new Stripe("sk_test_e2e");

interface FakeLine {
  id: string;
  quantity: number;
  unit_amount: number;
  currency: string;
  name: string;
  productId: string;
}

interface FakeSession {
  id: string;
  object: "checkout.session";
  mode: "payment";
  status: "open" | "complete";
  payment_status: "unpaid" | "paid";
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
  client_reference_id: string | null;
  customer_email: string | null;
  customer_details: { email: string } | null;
  payment_intent: string | null;
  success_url: string;
  cancel_url: string;
  url: string;
}

const sessions = new Map<string, { session: FakeSession; lines: FakeLine[] }>();

function randomId(prefix: string): string {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

type Nested = { [key: string]: Nested | string };

// The SDK form-encodes bodies with bracketed keys: line_items[0][quantity]=1.
function parseForm(body: string): Nested {
  const root: Nested = {};
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const parts = rawKey.replace(/\]/g, "").split("[");
    let node = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = value;
      } else {
        if (typeof node[part] !== "object") node[part] = {};
        node = node[part] as Nested;
      }
    });
  }
  return root;
}

function field(node: Nested | string | undefined, ...path: string[]): string | undefined {
  let current: Nested | string | undefined = node;
  for (const key of path) {
    if (!current || typeof current === "string") return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function missing(response: ServerResponse, id: string) {
  sendJson(response, 404, {
    error: {
      type: "invalid_request_error",
      code: "resource_missing",
      message: `No such checkout.session: '${id}'`,
    },
  });
}

function redirect(response: ServerResponse, location: string) {
  response.writeHead(303, { Location: location });
  response.end();
}

function createSession(form: Nested): FakeSession & { lines: FakeLine[] } {
  const lines: FakeLine[] = [];
  const items = (form.line_items ?? {}) as Nested;
  for (const key of Object.keys(items).sort((a, b) => Number(a) - Number(b))) {
    const item = items[key] as Nested;
    lines.push({
      id: randomId("li_test_"),
      quantity: Number(field(item, "quantity")),
      unit_amount: Number(field(item, "price_data", "unit_amount")),
      currency: field(item, "price_data", "currency") ?? "usd",
      name: field(item, "price_data", "product_data", "name") ?? "",
      productId: field(item, "price_data", "product_data", "metadata", "productId") ?? "",
    });
  }
  const id = randomId("cs_test_");
  const metadata = (form.metadata ?? {}) as Record<string, string>;
  return {
    id,
    object: "checkout.session",
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    amount_total: lines.reduce((sum, line) => sum + line.unit_amount * line.quantity, 0),
    currency: lines[0]?.currency ?? "usd",
    metadata,
    client_reference_id: field(form, "client_reference_id") ?? null,
    customer_email: field(form, "customer_email") ?? null,
    customer_details: null,
    payment_intent: null,
    success_url: field(form, "success_url") ?? "",
    cancel_url: field(form, "cancel_url") ?? "",
    url: `${BASE}/pay/${id}`,
    lines,
  };
}

function lineItemsList(lines: FakeLine[]) {
  return {
    object: "list",
    has_more: false,
    url: "/v1/checkout/sessions/line_items",
    data: lines.map((line) => ({
      id: line.id,
      object: "item",
      quantity: line.quantity,
      description: line.name,
      price: {
        object: "price",
        unit_amount: line.unit_amount,
        currency: line.currency,
        product: {
          object: "product",
          name: line.name,
          metadata: { productId: line.productId },
        },
      },
    })),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function payPage(session: FakeSession): string {
  const total = (session.amount_total / 100).toFixed(2);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Stripe Checkout</title></head>
<body><main><h1>Fake Stripe Checkout</h1><p>Total: ${escapeHtml(total)} ${escapeHtml(session.currency.toUpperCase())}</p>
<form method="post" action="/pay/${session.id}/complete"><button type="submit">Pay</button></form>
<form method="post" action="/pay/${session.id}/cancel"><button type="submit">Cancel</button></form></main></body></html>`;
}

async function completeAndNotify(session: FakeSession): Promise<number> {
  session.status = "complete";
  session.payment_status = "paid";
  session.payment_intent = randomId("pi_test_");
  session.customer_details = { email: session.customer_email ?? "guest@example.test" };
  // A completed session's url is null in Stripe's events.
  const payload = JSON.stringify({
    id: randomId("evt_test_"),
    object: "event",
    type: "checkout.session.completed",
    data: { object: { ...session, url: null } },
  });
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const response = await fetch(`${APP_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": header },
    body: payload,
  });
  return response.status;
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", BASE);
  const method = request.method ?? "GET";
  const path = url.pathname;

  if (method === "GET" && path === "/health") return sendJson(response, 200, { ok: true });

  if (method === "POST" && path === "/v1/checkout/sessions") {
    const { lines, ...session } = createSession(parseForm(await readBody(request)));
    sessions.set(session.id, { session, lines });
    return sendJson(response, 200, session);
  }

  const api = path.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/line_items)?$/);
  if (method === "GET" && api) {
    const entry = sessions.get(api[1]);
    if (!entry) return missing(response, api[1]);
    return sendJson(response, 200, api[2] ? lineItemsList(entry.lines) : entry.session);
  }

  const pay = path.match(/^\/pay\/([^/]+)(\/complete|\/cancel)?$/);
  if (pay) {
    const entry = sessions.get(pay[1]);
    if (!entry) return missing(response, pay[1]);
    const { session } = entry;
    if (method === "GET" && !pay[2]) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return response.end(payPage(session));
    }
    if (method === "POST" && pay[2] === "/cancel") return redirect(response, session.cancel_url);
    if (method === "POST" && pay[2] === "/complete") {
      const status = await completeAndNotify(session);
      if (status !== 200) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        return response.end(`The app's webhook answered ${status}`);
      }
      return redirect(response, session.success_url.replace("{CHECKOUT_SESSION_ID}", session.id));
    }
  }

  sendJson(response, 404, {
    error: { type: "invalid_request_error", message: `Fake Stripe has no ${method} ${path}` },
  });
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error("fake Stripe failed:", error instanceof Error ? error.message : error);
    if (!response.headersSent) sendJson(response, 500, { error: { type: "api_error" } });
  });
}).listen(PORT, () => console.log(`Fake Stripe listening on ${BASE}`));
