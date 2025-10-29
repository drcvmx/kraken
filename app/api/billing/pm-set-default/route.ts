// app/api/billing/pm-set-default/route.ts
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

// Lazy initialization to avoid build-time errors
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
    const sql = `SELECT 1 FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND TRIM(UPPER(RDB$RELATION_NAME)) = ?`;
    return await new Promise<boolean>((res, rej) => {
        db.query(sql, [name.trim().toUpperCase()], (e, rows: any[]) => (e ? rej(e) : res(!!rows?.length)));
    });
}

async function getCustomerIdAndSubscription(tenant: string): Promise<{ customerId: string | null, subscriptionId: string | null }> {
    return withFb(async (db) => {
        let customer_id: string | null = null;
        let sub_id: string | null = null;

        if (await tableExists(db, "SUSCRIPCIONES")) {
            const q = `
        SELECT FIRST 1 CUSTOMER_ID, SUBSCRIPTION_ID
        FROM SUSCRIPCIONES
        WHERE TRIM(LOWER(TENANT)) = ?
        ORDER BY COALESCE(UPDATED_AT, CREATED_AT) DESC
      `;
            const rows = await new Promise<any[]>((res, rej) => {
                db.query(q, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
            });
            if (rows.length) {
                customer_id = rows[0].CUSTOMER_ID || null;
                sub_id = rows[0].SUBSCRIPTION_ID || null;
            }
        }

        if (!customer_id && await tableExists(db, "PAGOS_SUSCRIPCION")) {
            const q2 = `
        SELECT FIRST 1 CUSTOMER_ID, SUBSCRIPTION_ID
        FROM PAGOS_SUSCRIPCION
        WHERE TRIM(LOWER(TENANT)) = ?
        ORDER BY CREATED_AT DESC
      `;
            const rows2 = await new Promise<any[]>((res, rej) => {
                db.query(q2, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
            });
            if (rows2.length) {
                customer_id = rows2[0].CUSTOMER_ID || null;
                sub_id = rows2[0].SUBSCRIPTION_ID || null;
            }
        }

        return { customerId: customer_id, subscriptionId: sub_id };
    });
}

export async function POST(req: NextRequest) {
    try {
        const stripe = getStripe();
        const { tenant, payment_method_id } = await req.json();
        const t = String(tenant || "").trim().toLowerCase();
        const pmId = String(payment_method_id || "").trim();
        if (!t || !pmId) return NextResponse.json({ error: "Faltan tenant o payment_method_id" }, { status: 400 });

        const { customerId, subscriptionId } = await getCustomerIdAndSubscription(t);
        if (!customerId) return NextResponse.json({ error: "No se encontró el cliente para este tenant" }, { status: 404 });

        // Asegura attachment al cliente
        try {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            const attachedTo = (pm.customer && typeof pm.customer === "string") ? pm.customer : null;
            if (!attachedTo || attachedTo !== customerId) {
                await stripe.paymentMethods.attach(pmId, { customer: customerId });
            }
        } catch (e) {
            // Si ya está attached, Stripe arroja error si es a otro customer
            // lo propagamos:
            throw e;
        }

        // Default en el Customer
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: pmId },
        });

        // Opcional: fija como default en suscripciones activas de ese customer
        try {
            const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
            for (const s of subs.data) {
                if (["active", "trialing", "past_due", "unpaid"].includes(String(s.status))) {
                    await stripe.subscriptions.update(s.id, { default_payment_method: pmId });
                }
            }
        } catch { }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Error actualizando método de pago" }, { status: 500 });
    }
}
