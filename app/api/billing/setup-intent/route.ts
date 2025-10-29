// /app/api/billing/setup-intent/route.ts
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
        try {
          db.detach();
        } catch {}
        reject(e);
      }
    });
  });
}

async function tableExists(db: fb.Database, name: string): Promise<boolean> {
  const sql = `SELECT 1 FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND TRIM(UPPER(RDB$RELATION_NAME)) = ?`;
  return await new Promise<boolean>((res, rej) => {
    db.query(sql, [name.trim().toUpperCase()], (e, rows: any[]) =>
      e ? rej(e) : res(!!rows?.length)
    );
  });
}

async function getCustomerIdByTenant(tenant: string): Promise<string | null> {
  return withFb(async (db) => {
    let customer_id: string | null = null;

    if (await tableExists(db, "SUSCRIPCIONES")) {
      const q = `
        SELECT FIRST 1 CUSTOMER_ID
        FROM SUSCRIPCIONES
        WHERE TRIM(LOWER(TENANT)) = ?
        ORDER BY COALESCE(UPDATED_AT, CREATED_AT) DESC
      `;
      const rows = await new Promise<any[]>((res, rej) => {
        db.query(q, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
      });
      if (rows.length && rows[0].CUSTOMER_ID)
        return rows[0].CUSTOMER_ID as string;
    }

    if (await tableExists(db, "PAGOS_SUSCRIPCION")) {
      const q2 = `
        SELECT FIRST 1 CUSTOMER_ID
        FROM PAGOS_SUSCRIPCION
        WHERE TRIM(LOWER(TENANT)) = ?
        ORDER BY CREATED_AT DESC
      `;
      const rows2 = await new Promise<any[]>((res, rej) => {
        db.query(q2, [tenant], (e, r) => (e ? rej(e) : res(r || [])));
      });
      if (rows2.length && rows2[0].CUSTOMER_ID)
        return rows2[0].CUSTOMER_ID as string;
    }

    return customer_id;
  });
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { tenant } = await req.json();
    const t = String(tenant || "")
      .trim()
      .toLowerCase();
    if (!t)
      return NextResponse.json({ error: "Falta tenant" }, { status: 400 });

    const customerId = await getCustomerIdByTenant(t);
    if (!customerId) {
      return NextResponse.json(
        { error: "No se encontró el cliente para este tenant" },
        { status: 404 }
      );
    }

    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { tenant: t, solution: "KRNK" },
    });

    return NextResponse.json(
      { client_secret: si.client_secret },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error creando SetupIntent" },
      { status: 500 }
    );
  }
}
