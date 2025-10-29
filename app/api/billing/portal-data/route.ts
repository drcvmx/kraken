// app/api/billing/portal-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as fb from "node-firebird";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ========= ENV ========= */
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

/* ========= Firebird ========= */
const fbConfig: fb.Options = {
    host: "localhost",
    port: 3050,
    database: "C:\\BS\\BLACKSHEEP.FDB",
    user: "SYSDBA",
    password: "BlueMamut$23",
    lowercase_keys: false,
};

function withFb<T = any>(fn: (db: fb.Database) => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
        fb.attach(fbConfig, async (err, db) => {
            if (err) return reject(err);
            try {
                const out = await fn(db);
                db.detach();
                resolve(out);
            } catch (e) {
                try { db.detach(); } catch { }
                reject(e);
            }
        });
    });
}

async function tableExists(db: fb.Database, name: string): Promise<boolean> {
    const sql = `SELECT 1
                 FROM RDB$RELATIONS
                WHERE RDB$SYSTEM_FLAG = 0
                  AND TRIM(UPPER(RDB$RELATION_NAME)) = ?`;
    return await new Promise<boolean>((res, rej) => {
        db.query(sql, [name.trim().toUpperCase()], (e, rows: any[]) =>
            e ? rej(e) : res(!!rows?.length)
        );
    });
}

export async function GET(req: NextRequest) {
    try {
        const stripe = getStripe();
        const url = new URL(req.url);
        const tenant = (url.searchParams.get("tenant") || "").trim().toLowerCase();
        if (!tenant) {
            return NextResponse.json({ error: "Falta tenant" }, { status: 400 });
        }

        // 1) Saca subscription_id / customer_id desde tu BD
        const ids = await withFb(async (db) => {
            let subscription_id: string | null = null;
            let customer_id: string | null = null;

            if (await tableExists(db, "SUSCRIPCIONES")) {
                const q = `
          SELECT FIRST 1 SUBSCRIPTION_ID, CUSTOMER_ID
            FROM SUSCRIPCIONES
           WHERE TRIM(LOWER(TENANT)) = ?
           ORDER BY COALESCE(UPDATED_AT, CREATED_AT) DESC
        `;
                const rows = await new Promise<any[]>((res, rej) => {
                    db.query(q, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (rows.length) {
                    subscription_id = rows[0].SUBSCRIPTION_ID || null;
                    customer_id = rows[0].CUSTOMER_ID || null;
                }
            }

            if (!subscription_id && (await tableExists(db, "PAGOS_SUSCRIPCION"))) {
                const q2 = `
          SELECT FIRST 1 SUBSCRIPTION_ID, CUSTOMER_ID
            FROM PAGOS_SUSCRIPCION
           WHERE TRIM(LOWER(TENANT)) = ?
           ORDER BY CREATED_AT DESC
        `;
                const rows2 = await new Promise<any[]>((res, rej) => {
                    db.query(q2, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (rows2.length) {
                    subscription_id = rows2[0].SUBSCRIPTION_ID || null;
                    customer_id = rows2[0].CUSTOMER_ID || null;
                }
            }

            return { subscription_id, customer_id };
        });

        // 2) Lee de Stripe
        let subscription: Stripe.Subscription | null = null;
        let customer: Stripe.Customer | null = null;

        if (ids.subscription_id) {
            try {
                subscription = await stripe.subscriptions.retrieve(ids.subscription_id, {
                    expand: ["items.data.price.product"],
                });
            } catch { }
        }

        if (!subscription && ids.customer_id) {
            const list = await stripe.subscriptions.list({
                customer: ids.customer_id,
                limit: 1,
                status: "all",
                expand: ["data.items.data.price.product"],
            });
            subscription = list.data[0] ?? null;
        }

        if (ids.customer_id) {
            try {
                customer = (await stripe.customers.retrieve(ids.customer_id)) as Stripe.Customer;
            } catch { }
        } else if (subscription) {
            const cid =
                typeof subscription.customer === "string"
                    ? subscription.customer
                    : subscription.customer?.id;
            if (cid) {
                customer = (await stripe.customers.retrieve(cid)) as Stripe.Customer;
            }
        }

        // 3) Método de pago por default
        let pmId: string | null = null;
        if (subscription?.default_payment_method) {
            pmId =
                typeof subscription.default_payment_method === "string"
                    ? subscription.default_payment_method
                    : subscription.default_payment_method.id;
        } else if (customer?.invoice_settings?.default_payment_method) {
            const x = customer.invoice_settings.default_payment_method;
            pmId = typeof x === "string" ? x : (x as Stripe.PaymentMethod).id;
        }

        let pm: Stripe.PaymentMethod | null = null;
        if (pmId) {
            try { pm = await stripe.paymentMethods.retrieve(pmId); } catch { }
        }

        // 3.1) Próxima fecha de facturación (con todos los fallbacks)
        let currentPeriodEnd: number | null =
            (subscription as any)?.current_period_end ??
            (subscription as any)?.current_period?.end ??
            null;

        if (!currentPeriodEnd && (subscription?.id || customer?.id)) {
            try {
                const invoicesAny = stripe.invoices as any;
                const upcoming: Stripe.Invoice = subscription?.id
                    ? await invoicesAny.retrieveUpcoming({ subscription: subscription.id })
                    : await invoicesAny.retrieveUpcoming({ customer: customer!.id });

                const line0 = upcoming?.lines?.data?.[0];
                currentPeriodEnd =
                    line0?.period?.end ?? (upcoming as any)?.period_end ?? null;
            } catch {
                // sin upcoming
            }
        }

        // ⬇️ Fallback final: toma la mejor fecha que tengas de tu BD
        if (!currentPeriodEnd) {
            const fromDb = await withFb(async (db) => {
                // SUSCRIPCIONES primero
                const q1 = `
          SELECT FIRST 1 CURRENT_PERIOD_END
            FROM SUSCRIPCIONES
           WHERE TRIM(LOWER(TENANT)) = ?
             AND CURRENT_PERIOD_END IS NOT NULL
             AND CURRENT_PERIOD_END > 0
           ORDER BY COALESCE(UPDATED_AT, CREATED_AT) DESC
        `;
                const r1 = await new Promise<any[]>((res, rej) => {
                    db.query(q1, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (r1.length && typeof r1[0].CURRENT_PERIOD_END === "number") {
                    return r1[0].CURRENT_PERIOD_END as number;
                }

                // Último pago con PERIOD_END
                const q2 = `
          SELECT FIRST 1 PERIOD_END
            FROM PAGOS_SUSCRIPCION
           WHERE TRIM(LOWER(TENANT)) = ?
             AND PERIOD_END IS NOT NULL
             AND PERIOD_END > 0
           ORDER BY CREATED_AT DESC
        `;
                const r2 = await new Promise<any[]>((res, rej) => {
                    db.query(q2, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (r2.length && typeof r2[0].PERIOD_END === "number") {
                    return r2[0].PERIOD_END as number;
                }
                return null;
            });

            if (fromDb) currentPeriodEnd = fromDb;
        }

        // 4) Invoices (historial)
        let invs: Stripe.ApiList<Stripe.Invoice> | null = null;
        if (customer?.id) {
            invs = await stripe.invoices.list({ customer: customer.id, limit: 20 });
        }

        // 5) Respuesta
        const planPrice = subscription?.items?.data?.[0]?.price || null;
        const planName =
            planPrice?.product && typeof planPrice.product !== "string"
                ? (planPrice.product as any).name
                : "Plan KRKN";

        const payload = {
            tenant,
            active:
                !!subscription &&
                ["active", "trialing", "past_due"].includes(String(subscription.status)),
            source: subscription
                ? ("SUSCRIPCIONES" as const)
                : ids.customer_id
                    ? ("PAGOS_SUSCRIPCION" as const)
                    : ("NONE" as const),
            subscription: subscription
                ? {
                    id: subscription.id,
                    status: subscription.status,
                    cancel_at_period_end: !!subscription.cancel_at_period_end,
                    current_period_end: currentPeriodEnd, // ← ya con todos los fallbacks
                    plan_name: planName,
                    price_id: planPrice?.id ?? null,
                    amount: planPrice?.unit_amount ?? null,
                    currency: planPrice?.currency ?? "mxn",
                    interval: planPrice?.recurring?.interval ?? "month",
                }
                : null,
            customer: customer
                ? {
                    id: customer.id,
                    email: customer.email ?? null,
                }
                : null,
            paymentMethod: pm
                ? {
                    id: pm.id,
                    brand: (pm.card?.brand ?? null) as any,
                    last4: (pm.card?.last4 ?? null) as any,
                    exp_month: pm.card?.exp_month ?? null,
                    exp_year: pm.card?.exp_year ?? null,
                }
                : null,
            invoices: (invs?.data || []).map((i) => ({
                id: i.id,
                number: i.number ?? null,
                created: i.created,
                amount_paid: i.amount_paid ?? 0,
                currency: i.currency ?? "mxn",
                status: i.status ?? "open",
                hosted_invoice_url: i.hosted_invoice_url ?? null,
                pdf: i.invoice_pdf ?? null,
                description: i.lines?.data?.[0]?.description ?? null,
            })),
        };

        return NextResponse.json(payload, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || "Error obteniendo datos" },
            { status: 500 }
        );
    }
}
