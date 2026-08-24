import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(context: Record<string, unknown>): string {
  const kpis       = context.kpis       as Record<string, number> | undefined;
  const derived    = context.derived    as Record<string, unknown> | undefined;
  const tickets    = context.tickets    as Array<{ status: string; count: number }> | undefined;
  const activity   = context.activity   as Array<{ action: string; count: number }> | undefined;
  const topAgences = context.topAgences as Array<{ agence: string; Clients: number }> | undefined;
  const days       = context.days       as number | undefined;

  const lines: string[] = [
    "Tu es un assistant IA intégré au tableau de bord admin du tenant GeoTrust.",
    "Tu réponds toujours en français, de façon concise, analytique et actionnable.",
    "Tu peux proposer des insights, détecter des anomalies, et recommander des actions.",
    "",
    `=== Données actuelles (période : ${days ?? 30} derniers jours) ===`,
    "",
  ];

  if (kpis) {
    lines.push("KPIs principaux :");
    lines.push(`  - Agences : ${kpis.agences}`);
    lines.push(`  - CAFs (agents terrain) : ${kpis.cafs}`);
    lines.push(`  - Clients : ${kpis.clients}`);
    lines.push(`  - Localisations GPS : ${kpis.locations}`);
    lines.push("");
  }

  if (derived) {
    lines.push("Indicateurs dérivés :");
    lines.push(`  - Taux de résolution tickets : ${derived.tauxResolution}%`);
    lines.push(`  - Moyenne clients/agence : ${derived.moyenneClients}`);
    lines.push(`  - Agences sans CAF affecté : ${derived.agencesSansCaf}`);
    lines.push(`  - Total utilisateurs : ${derived.totalUsers}`);
    lines.push(`  - Tendance activité (1ère vs 2ème moitié de période) : ${derived.tendance}%`);
    lines.push("");
  }

  if (tickets && tickets.length > 0) {
    lines.push("Tickets IT par statut :");
    tickets.forEach((t) => lines.push(`  - ${t.status} : ${t.count}`));
    lines.push("");
  }

  if (activity && activity.length > 0) {
    lines.push("Activité par type d'action :");
    activity.forEach((a) => lines.push(`  - ${a.action} : ${a.count} événements`));
    lines.push("");
  }

  if (topAgences && topAgences.length > 0) {
    lines.push("Top agences par nombre de clients :");
    topAgences.slice(0, 5).forEach((a, i) =>
      lines.push(`  ${i + 1}. ${a.agence} — ${a.Clients} clients`)
    );
    lines.push("");
  }

  lines.push("Si une information n'est pas dans ce contexte, dis-le clairement.");
  lines.push("Tes réponses doivent être courtes (3-6 phrases max) sauf si l'utilisateur demande un rapport détaillé.");

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API Anthropic manquante. Ajoutez ANTHROPIC_API_KEY dans .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    const context: Record<string, unknown> = body.context ?? {};

    if (!messages.length) {
      return NextResponse.json({ error: "Messages vides" }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let userMessage = "Le service IA est temporairement indisponible. Veuillez réessayer.";
      try {
        const errJson = JSON.parse(errText);
        const type = errJson?.error?.type ?? "";
        if (type === "authentication_error") {
          userMessage = "Clé API invalide. Vérifiez ANTHROPIC_API_KEY dans .env.local.";
        } else if (type === "rate_limit_error") {
          userMessage = "Limite de requêtes atteinte. Réessayez dans quelques instants.";
        } else if (type === "overloaded_error") {
          userMessage = "Le service IA est surchargé. Réessayez dans un moment.";
        } else if (errJson?.error?.message) {
          userMessage = `Erreur IA : ${errJson.error.message}`;
        }
      } catch { /* keep default */ }
      return NextResponse.json({ error: userMessage }, { status: response.status });
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text ?? "";
    return NextResponse.json({ content });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
