// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as fb from "node-firebird";
import * as path from "path";
import * as fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ========= Stripe init ========= */
function required(name: string) {
  const v = process.env[name];
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

function getWebhookSecret() {
  return required("STRIPE_WEBHOOK_SECRET_BS");
}

/* ========= Firebird config ========= */
const fbConfig: fb.Options = {
  host: "localhost",
  port: 3050,
  database: "C:\\BS\\BLACKSHEEP.FDB",
  user: "SYSDBA",
  password: "BlueMamut$23",
  lowercase_keys: false,
};

/* ========= Logging ========= */
const LOGS_DIR = path.join(process.cwd(), "LOGS");
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function logLine(msg: string) {
  const file = path.join(
    LOGS_DIR,
    `stripe_webhook_${new Date().toISOString().slice(0, 10)}.log`
  );
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
}

/* ========= Helpers ========= */
function withFb<T = any>(fn: (db: fb.Database) => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    fb.attach(fbConfig, async (err, db) => {
      if (err) return reject(err);
      try {
        const out = await fn(db);
        db.detach();
        resolve(out);
      } catch (e) {
        try {
          db.detach();
        } catch { }
        reject(e);
      }
    });
  });
}

// Guarda event.id para idempotencia (incluye SOLUCION)
async function registerEventId(
  eventId: string,
  solucion: string | null
): Promise<boolean> {
  const sql =
    "INSERT INTO STRIPE_EVENTS (EVENT_ID, SOLUCION, CREATED_AT) VALUES (?, ?, CURRENT_TIMESTAMP)";
  try {
    await withFb((db) => {
      return new Promise<void>((res, rej) => {
        db.query(sql, [eventId, solucion], (e) => (e ? rej(e) : res()));
      });
    });
    return true;
  } catch {
    // Ya insertado (PK/UNIQUE), ignorar reprocesos
    return false;
  }
}

/* ========= Persistencia pagos ========= */
async function upsertPayment({
  tenant,
  solucion,
  customerId,
  subscriptionId,
  invoiceId,
  paymentIntentId,
  amountPaid,
  currency,
  status,
  email,
  periodStart,
  periodEnd,
}: {
  tenant: string;
  solucion: string; // KRNK
  customerId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  amountPaid: number;
  currency: string;
  status: string;
  email?: string | null;
  periodStart?: number | null;
  periodEnd?: number | null;
}) {
  const sql = `
    UPDATE OR INSERT INTO PAGOS_SUSCRIPCION (
      INVOICE_ID, TENANT, SOLUCION, CUSTOMER_ID, SUBSCRIPTION_ID, PAYMENT_INTENT_ID,
      AMOUNT_PAID, CURRENCY, STATUS, USER_EMAIL, PERIOD_START, PERIOD_END, CREATED_AT
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(
      (SELECT CREATED_AT FROM PAGOS_SUSCRIPCION P WHERE P.INVOICE_ID = ?), CURRENT_TIMESTAMP
    ))
    MATCHING (INVOICE_ID)
  `;
  const params = [
    invoiceId ?? null,
    tenant,
    solucion,
    customerId,
    subscriptionId ?? null,
    paymentIntentId ?? null,
    amountPaid,
    (currency || "mxn").toUpperCase(),
    status,
    email ?? null,
    periodStart ?? null,
    periodEnd ?? null,
    invoiceId ?? null,
  ];

  await withFb((db) => {
    return new Promise<void>((res, rej) => {
      db.query(sql, params, (e) => (e ? rej(e) : res()));
    });
  });
}

/* ========= Persistencia suscripción ========= */
async function upsertSubscription({
  tenant,
  solucion,
  subscriptionId,
  customerId,
  priceId,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  tenant: string;
  solucion: string; // KRNK
  subscriptionId: string;
  customerId: string;
  priceId?: string | null;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}) {
  const sql = `
    UPDATE OR INSERT INTO SUSCRIPCIONES (
      SUBSCRIPTION_ID, TENANT, SOLUCION, CUSTOMER_ID, PRICE_ID, STATUS,
      CURRENT_PERIOD_START, CURRENT_PERIOD_END, CANCEL_AT_PERIOD_END, UPDATED_AT, CREATED_AT
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE(
      (SELECT CREATED_AT FROM SUSCRIPCIONES S WHERE S.SUBSCRIPTION_ID = ?), CURRENT_TIMESTAMP
    ))
    MATCHING (SUBSCRIPTION_ID)
  `;
  const params = [
    subscriptionId,
    tenant,
    solucion,
    customerId,
    priceId ?? null,
    status,
    currentPeriodStart ?? 0,
    currentPeriodEnd ?? 0,
    cancelAtPeriodEnd ? 1 : 0,
    subscriptionId,
  ];

  await withFb((db) => {
    return new Promise<void>((res, rej) => {
      db.query(sql, params, (e) => (e ? rej(e) : res()));
    });
  });
}

/* ========= Util: lee IDs de objetos string | objeto ========= */
function asId(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "id" in v) {
    const id = (v as { id?: string }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/* ========= Util: de dónde saco SOLUTION ========= */
function getSolutionFromEvent(ev: Stripe.Event): string {
  const t = ev.type;
  try {
    if (t === "checkout.session.completed") {
      const s = ev.data.object as Stripe.Checkout.Session;
      return (s.metadata?.solution ?? "KRNK").toUpperCase();
    }
    if (t.startsWith("customer.subscription")) {
      const s = ev.data.object as Stripe.Subscription;
      return (s.metadata?.solution ?? "KRNK").toUpperCase();
    }
    if (t.startsWith("invoice.")) {
      const inv = ev.data.object as Stripe.Invoice;
      return (inv.metadata?.solution ?? "KRNK").toUpperCase();
    }
  } catch { }
  return "KRNK";
}

/* ========= Handler ========= */
export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  // 1) Verifica firma con raw body
  try {
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json(
        { error: "Missing stripe-signature" },
        { status: 400 }
      );
    }
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err: any) {
    logLine(`❌ Signature error: ${err?.message}`);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // 2) Idempotencia (con solución)
  const solution = getSolutionFromEvent(event);
  const inserted = await registerEventId(event.id, solution);
  if (!inserted) {
    logLine(`🔁 Duplicate ignored: ${event.id} (${event.type})`);
    return NextResponse.json(
      { received: true, duplicate: true },
      { status: 200 }
    );
  }

  try {
    switch (event.type) {
      /* ====== Checkout completado (crea suscripción) ====== */
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        const tenant = (s.metadata?.tenant ?? "").toLowerCase();
        const solucion = (s.metadata?.solution ?? "KRNK").toUpperCase();

        const email =
          s.customer_details?.email ?? s.metadata?.userEmail ?? null;

        const customerId = asId(s.customer) ?? "";
        const subscriptionId = asId(s.subscription);
        const invoiceId = asId(s.invoice);
        const paymentIntentId = asId(s.payment_intent);

        await upsertPayment({
          tenant,
          solucion,
          customerId,
          subscriptionId,
          invoiceId,
          paymentIntentId,
          amountPaid: s.amount_total ?? 0,
          currency: s.currency ?? "mxn",
          status: s.payment_status ?? "unknown",
          email,
          periodStart: null,
          periodEnd: null,
        });

        break;
      }

      /* ====== Cobro de factura de suscripción pagada ====== */
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const invAny = inv as any;

        const tenant = (inv.metadata?.tenant ?? "").toLowerCase();
        const solucion = (inv.metadata?.solution ?? "KRNK").toUpperCase();

        const customerId = asId(inv.customer) ?? "";
        const subscriptionId = asId(invAny.subscription);
        const paymentIntentId = asId(invAny.payment_intent);

        const line0 = inv.lines?.data?.[0];
        const periodStart = line0?.period?.start ?? null;
        const periodEnd = line0?.period?.end ?? null;

        await upsertPayment({
          tenant,
          solucion,
          customerId,
          subscriptionId,
          invoiceId: inv.id,
          paymentIntentId,
          amountPaid: inv.amount_paid ?? 0,
          currency: inv.currency ?? "mxn",
          status: "paid",
          email: inv.customer_email ?? null,
          periodStart,
          periodEnd,
        });

        // ⬇️ NUEVO: persiste también en SUSCRIPCIONES el periodo actual
        if (subscriptionId && periodStart && periodEnd) {
          await withFb((db) => {
            return new Promise<void>((res, rej) => {
              const sql = `
                UPDATE SUSCRIPCIONES
                   SET CURRENT_PERIOD_START = ?,
                       CURRENT_PERIOD_END   = ?,
                       UPDATED_AT           = CURRENT_TIMESTAMP
                 WHERE SUBSCRIPTION_ID = ?
              `;
              db.query(sql, [periodStart, periodEnd, subscriptionId], (e) => (e ? rej(e) : res()));
            });
          });
        }

        break;
      }

      /* ====== Altas/updates/baja de la suscripción ====== */
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subAny = sub as any;

        const tenant = (sub.metadata?.tenant ?? "").toLowerCase();
        const solucion = (sub.metadata?.solution ?? "KRNK").toUpperCase();

        const customerId = asId(sub.customer) ?? "";
        const price = sub.items?.data?.[0]?.price;

        const currentPeriodStart: number =
          (subAny.current_period_start as number) ?? 0;
        const currentPeriodEnd: number =
          (subAny.current_period_end as number) ?? 0;

        await upsertSubscription({
          tenant,
          solucion,
          subscriptionId: sub.id,
          customerId,
          priceId: price?.id ?? null,
          status: sub.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        });
        break;
      }

      default:
        // Otros eventos posibles: payment_intent.succeeded / .payment_failed
        logLine(`ℹ️ Unhandled event: ${event.type}`);
    }

    logLine(`✅ Processed: ${event.id} (${event.type})`);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    logLine(`💥 Handler error: ${e?.message}`);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
