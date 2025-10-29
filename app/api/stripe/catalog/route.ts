// api/stripe/catalog/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   Env + Stripe init (robusto)
   ========================= */
function required(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

let stripeInstance: Stripe | null = null;
function getStripe() {
  if (!stripeInstance) {
    stripeInstance = new Stripe(required("STRIPE_SECRET_KEY_BS"));
  }
  return stripeInstance;
}

/* =========================
   Util: retry con backoff
   ========================= */
type RetryableFn<T> = () => Promise<T>;

function shouldRetryStripeError(err: any): boolean {
  const code = err?.code || err?.raw?.code;
  const status = err?.statusCode || err?.status;
  const retryableCodes = new Set([
    "rate_limit",
    "lock_timeout",
    "api_connection_error",
    "api_error",
    "idempotency_error",
  ]);
  if (code && retryableCodes.has(code)) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (!code && !status) return true;
  return false;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function withRetry<T>(
  fn: RetryableFn<T>,
  {
    maxAttempts = 4,
    baseDelayMs = 200,
    maxDelayMs = 2000,
  }: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  let attempt = 0;
  let lastErr: any;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      attempt++;
      if (attempt >= maxAttempts || !shouldRetryStripeError(err)) break;
      const backoff = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1),
        maxDelayMs
      );
      const jitter = Math.floor(Math.random() * 150);
      await sleep(backoff + jitter);
    }
  }
  throw lastErr;
}

/* =========================
   Helpers multi-tenant
   ========================= */
// Si un recurso es "private", sólo se muestra a tenants permitidos.
// Leemos allowed_tenants | tenants como lista CSV.
function tenantAllowed(md: Record<string, string>, tenant: string) {
  const list = (md.tenants || md.allowed_tenants || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return true; // sin lista = global
  return list.includes(tenant);
}

// Aplica reglas de visibilidad combinando scope del producto y del precio.
function priceVisibleForTenant(
  priceMd: Record<string, string>,
  productMd: Record<string, string>,
  tenant: string
) {
  const pScope = (productMd.scope || "").toLowerCase();
  const prScope = (priceMd.scope || "").toLowerCase();

  // Si el precio es private, manda el precio
  if (prScope === "private") return tenantAllowed(priceMd, tenant);

  // Si el producto es private, hereda visibilidad
  if (pScope === "private") return tenantAllowed(productMd, tenant);

  // Por defecto visible
  return true;
}

/* =========================
   Catálogo: 1 producto por product_key
   ========================= */
const REQUIRED_PRODUCT_KEY = "krkn_plan_unico";

export async function GET(req: NextRequest) {
  try {
    const stripe = getStripe();

    const url = new URL(req.url);
    const tenant = (url.searchParams.get("tenant") || "").toLowerCase().trim();
    const currency = (url.searchParams.get("currency") || "mxn").toLowerCase();
    const productKey = (
      url.searchParams.get("product_key") || REQUIRED_PRODUCT_KEY
    ).toLowerCase();

    // En esta ruta exigimos tenant (como en tu versión enfocada a KRKN)
    if (!tenant) return NextResponse.json({ items: [] }, { status: 200 });

    // Buscar SOLO el producto activo con ese product_key
    const prods = await withRetry(
      () =>
        stripe.products.search({
          query: `active:'true' AND metadata['product_key']:'${productKey}'`,
          limit: 1,
        }),
      { maxAttempts: 4 }
    );

    const p = prods.data[0];
    if (!p) return NextResponse.json({ items: [] }, { status: 200 });

    const pmd = (p.metadata || {}) as Record<string, string>;
    const pScope = (pmd.scope || "").toLowerCase();

    // Si el producto es private y el tenant no está permitido, ocultamos
    if (pScope === "private" && !tenantAllowed(pmd, tenant)) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    // Listar precios del producto (con retry), filtrar por currency y visibilidad
    const prices = await withRetry(
      () =>
        stripe.prices.list({
          product: p.id,
          active: true,
          limit: 100,
        }),
      { maxAttempts: 4 }
    );

    const recurringPrices = prices.data
      .filter((pr) => pr.recurring)
      .filter((pr) => pr.currency.toLowerCase() === currency)
      .filter((pr) =>
        priceVisibleForTenant(
          (pr.metadata || {}) as Record<string, string>,
          pmd,
          tenant
        )
      )
      .map((pr) => ({
        price_id: pr.id,
        lookup_key: pr.lookup_key || null,
        nickname: pr.nickname || null,
        currency: pr.currency,
        unit_amount: pr.unit_amount,
        interval: pr.recurring?.interval,
        interval_count: pr.recurring?.interval_count ?? 1,
      }))
      .sort((a, b) => {
        const ord = (x: any) =>
          x.interval === "year"
            ? 3
            : x.interval === "month"
            ? 2
            : x.interval === "week"
            ? 1
            : 0;
        if (a.interval !== b.interval) return ord(a) - ord(b);
        return (a.interval_count ?? 1) - (b.interval_count ?? 1);
      });

    if (!recurringPrices.length)
      return NextResponse.json({ items: [] }, { status: 200 });

    return NextResponse.json(
      {
        items: [
          {
            product_id: p.id,
            product_key: pmd.product_key ?? null,
            name: p.name,
            description: p.description,
            active: p.active,
            prices: recurringPrices,
          },
        ],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[/api/stripe/catalog] error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
