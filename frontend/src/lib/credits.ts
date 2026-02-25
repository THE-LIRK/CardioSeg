import { createServerSupabaseClient } from "@/lib/supabase-server";
import { CONFIG } from "@/lib/config";

export interface UserCredits {
  credits: number;
  freeUsedThisMonth: number;
  freeRemaining: number;
  totalAvailable: number;
}

/**
 * Récupère les crédits d'un utilisateur depuis Supabase.
 * Si l'utilisateur n'a pas de ligne, on en crée une.
 */
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Créer une ligne par défaut
    await supabase
      .from("user_credits")
      .insert({
        user_id: userId,
        credits: 0,
        free_used_this_month: 0,
        last_free_reset: new Date().toISOString(),
      })
      .select()
      .single();

    return {
      credits: 0,
      freeUsedThisMonth: 0,
      freeRemaining: CONFIG.FREE_MONTHLY_CREDITS,
      totalAvailable: CONFIG.FREE_MONTHLY_CREDITS,
    };
  }

  // Vérifier si on doit reset les crédits gratuits (nouveau mois)
  const lastReset = new Date(data.last_free_reset);
  const now = new Date();
  let freeUsed = data.free_used_this_month;

  if (
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear()
  ) {
    // Nouveau mois → reset les crédits gratuits
    freeUsed = 0;
    await supabase
      .from("user_credits")
      .update({
        free_used_this_month: 0,
        last_free_reset: now.toISOString(),
      })
      .eq("user_id", userId);
  }

  const freeRemaining = Math.max(0, CONFIG.FREE_MONTHLY_CREDITS - freeUsed);

  return {
    credits: data.credits,
    freeUsedThisMonth: freeUsed,
    freeRemaining,
    totalAvailable: data.credits + freeRemaining,
  };
}

/**
 * Consomme un crédit pour une segmentation.
 * Utilise d'abord les crédits gratuits, puis les crédits payants.
 */
export async function consumeCredit(userId: string): Promise<boolean> {
  const userCredits = await getUserCredits(userId);

  if (userCredits.totalAvailable <= 0) {
    return false;
  }

  const supabase = createServerSupabaseClient();

  if (userCredits.freeRemaining > 0) {
    // Utiliser un crédit gratuit
    await supabase
      .from("user_credits")
      .update({
        free_used_this_month: userCredits.freeUsedThisMonth + 1,
      })
      .eq("user_id", userId);
  } else {
    // Utiliser un crédit payant
    await supabase
      .from("user_credits")
      .update({
        credits: userCredits.credits - 1,
      })
      .eq("user_id", userId);
  }

  return true;
}

/**
 * Ajoute des crédits après un achat Stripe.
 */
export async function addCredits(
  userId: string,
  amount: number
): Promise<void> {
  const supabase = createServerSupabaseClient();

  // Vérifier si l'utilisateur existe déjà
  const { data } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (data) {
    await supabase
      .from("user_credits")
      .update({ credits: data.credits + amount })
      .eq("user_id", userId);
  } else {
    await supabase.from("user_credits").insert({
      user_id: userId,
      credits: amount,
      free_used_this_month: 0,
      last_free_reset: new Date().toISOString(),
    });
  }
}
