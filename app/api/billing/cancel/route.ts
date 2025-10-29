import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as fb from "node-firebird";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function required(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env ${name}`);
    return v;
}

let stripeInstance: Stripe | null = null;
function getStripe() {
    if (!stripeInstance) {
        stripeInstance = new Stripe(required("STRIPE_SECRET_KEY_BS"), { apiVersion: "2025-09-30.clover" });
    }
    return stripeInstance;
}

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

export async function POST(req: NextRequest) {
    try {
        const stripe = getStripe();
        const { tenant } = await req.json();
        if (!tenant) return NextResponse.json({ error: "Falta tenant" }, { status: 400 });

        // Encuentra el subscription_id más reciente para el tenant
        const { subscription_id } = await withFb(async (db) => {
            let sub: string | null = null;
            if (await tableExists(db, "SUSCRIPCIONES")) {
                const q = `
          SELECT FIRST 1 SUBSCRIPTION_ID
          FROM SUSCRIPCIONES
          WHERE TRIM(LOWER(TENANT)) = ?
          ORDER BY COALESCE(UPDATED_AT, CREATED_AT) DESC
        `;
                const rows = await new Promise<any[]>((res, rej) => {
                    db.query(q, [tenant.toLowerCase()], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (rows.length) sub = rows[0].SUBSCRIPTION_ID || null;
            }
            if (!sub && await tableExists(db, "PAGOS_SUSCRIPCION")) {
                const q2 = `
          SELECT FIRST 1 SUBSCRIPTION_ID
          FROM PAGOS_SUSCRIPCION
          WHERE TRIM(LOWER(TENANT)) = ?
          ORDER BY CREATED_AT DESC
        `;
                const rows2 = await new Promise<any[]>((res, rej) => {
                    db.query(q2, [tenant.toLowerCase()], (e, r) => (e ? rej(e) : res(r || [])));
                });
                if (rows2.length) sub = rows2[0].SUBSCRIPTION_ID || null;
            }
            return { subscription_id: sub };
        });

        if (!subscription_id) {
            return NextResponse.json({ error: "No se encontró la suscripción del tenant" }, { status: 404 });
        }

        // Programa cancelación al fin del periodo
        const updated = await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true });

        // Actualiza tu tabla si existe
        await withFb(async (db) => {
            if (!(await tableExists(db, "SUSCRIPCIONES"))) return;
            const up = `
        UPDATE OR INSERT INTO SUSCRIPCIONES (
          SUBSCRIPTION_ID, TENANT, STATUS, CANCEL_AT_PERIOD_END, UPDATED_AT
        )
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        MATCHING (SUBSCRIPTION_ID)
      `;
            const params = [
                subscription_id,
                tenant.toLowerCase(),
                updated.status,
                updated.cancel_at_period_end ? 1 : 0,
            ];
            await new Promise<void>((res, rej) => {
                db.query(up, params, (e) => (e ? rej(e) : res()));
            });
        });

        return NextResponse.json({ ok: true, subscription_id, cancel_at_period_end: updated.cancel_at_period_end }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Error cancelando" }, { status: 500 });
    }
}
