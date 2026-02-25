import { NextResponse } from "next/server";
import { getUserCredits } from "@/lib/credits";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId requis" },
      { status: 400 }
    );
  }

  try {
    const credits = await getUserCredits(userId);
    return NextResponse.json(credits);
  } catch (err) {
    console.error("Credits error:", err);
    return NextResponse.json(
      { error: "Erreur récupération crédits" },
      { status: 500 }
    );
  }
}
