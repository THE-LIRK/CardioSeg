import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";

/**
 * Vérifie une session Stripe Checkout et ajoute les crédits si le paiement est confirmé.
 * Alternative au webhook — appelé quand l'utilisateur revient sur le site après paiement.
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId requis" },
        { status: 400 }
      );
    }

    // Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Vérifier que le paiement est bien complété
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Paiement non confirmé" },
        { status: 400 }
      );
    }

    const userId = session.metadata?.userId;
    const credits = parseInt(session.metadata?.credits || "0");

    if (!userId || credits <= 0) {
      return NextResponse.json(
        { error: "Métadonnées invalides" },
        { status: 400 }
      );
    }

    // Vérifier qu'on n'a pas déjà crédité cette session (idempotence)
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase-server"
    );
    const supabase = createServerSupabaseClient();

    // Chercher si cette session a déjà été traitée
    const { data: existing } = await supabase
      .from("payment_logs")
      .select("id")
      .eq("stripe_session_id", session.id)
      .single();

    if (existing) {
      // Déjà crédité — on retourne succès sans re-créditer
      return NextResponse.json({
        success: true,
        credits,
        alreadyProcessed: true,
      });
    }

    // Ajouter les crédits
    await addCredits(userId, credits);

    // Logger le paiement pour éviter les doublons
    await supabase.from("payment_logs").insert({
      stripe_session_id: session.id,
      user_id: userId,
      credits_added: credits,
      amount_paid: session.amount_total,
      currency: session.currency,
    });

    console.log(
      `✅ ${credits} crédits ajoutés pour ${userId} (session ${session.id})`
    );

    return NextResponse.json({ success: true, credits, alreadyProcessed: false });
  } catch (err: unknown) {
    console.error("Confirm payment error:", err);
    const message =
      err instanceof Error ? err.message : "Erreur confirmation paiement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
