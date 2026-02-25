import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { CONFIG } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const { priceId, userId, userEmail } = await request.json();

    if (!priceId || !userId) {
      return NextResponse.json(
        { error: "priceId et userId requis" },
        { status: 400 }
      );
    }

    // Trouver le pack correspondant
    const pack = CONFIG.CREDIT_PACKS.find((p) => p.priceId === priceId);
    if (!pack) {
      return NextResponse.json(
        { error: "Pack introuvable" },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://frontend-psi-swart-10.vercel.app";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/upload?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        userId,
        credits: pack.credits.toString(),
        packId: pack.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const message =
      err instanceof Error ? err.message : "Erreur création session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
