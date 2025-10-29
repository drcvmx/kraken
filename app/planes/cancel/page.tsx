// app/planes/cancel/page.tsx
// Página de cancelación de pago de plan
import Stripe from "stripe";

export const dynamic = "force-dynamic";

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

type Props = { searchParams: { price?: string } };

export default async function Cancel({ searchParams }: Props) {
  const priceId = searchParams.price;
  let price: Stripe.Price | null = null;
  let product: Stripe.Product | null = null;

  if (priceId) {
    try {
      const stripe = getStripe();
      price = await stripe.prices.retrieve(priceId);
      const prodId =
        typeof price.product === "string"
          ? price.product
          : (price.product as Stripe.Product).id;
      product = await stripe.products.retrieve(prodId);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/70 to-zinc-950/70 p-6">
          <div className="text-rose-400 text-sm">✕ Pago cancelado</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            El pago fue cancelado
          </h1>

          {price && product ? (
            <div className="mt-4 text-zinc-300">
              Estabas por adquirir:{" "}
              <span className="font-medium">{product.name}</span>{" "}
              <span className="text-zinc-500">
                ({price.recurring?.interval === "year" ? "Anual" : "Mensual"})
              </span>
            </div>
          ) : (
            <p className="mt-4 text-zinc-400">
              Puedes volver a intentarlo cuando gustes.
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <a
              href="/planes"
              className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-white/10"
            >
              Elegir plan
            </a>
            <a
              href="/dashboard"
              className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-white/10"
            >
              Volver al inicio
            </a>
          </div>

          {priceId && (
            <div className="mt-8 text-xs text-zinc-500">
              Price seleccionado: {priceId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
