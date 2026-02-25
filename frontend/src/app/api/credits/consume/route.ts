import { NextResponse } from "next/server";
import { consumeCredit } from "@/lib/credits";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId requis" },
        { status: 400 }
      );
    }

    const success = await consumeCredit(userId);

    if (!success) {
      return NextResponse.json(
        { error: "Crédits insuffisants", needCredits: true },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Consume credit error:", err);
    return NextResponse.json(
      { error: "Erreur consommation crédit" },
      { status: 500 }
    );
  }
}
