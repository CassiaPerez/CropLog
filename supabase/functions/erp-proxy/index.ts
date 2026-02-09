import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders: Record<string, string> = {
  // Em DEV: "*" (origens mudam muito). Em PROD: troque por seu domínio.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, origin",
  "Access-Control-Max-Age": "86400",
  // Ajuda cache/proxy a não “misturar” origens
  Vary: "Origin",
};

interface RequestBody {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}

Deno.serve(async (req: Request) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // (Opcional) bloqueie métodos indesejados na sua function
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Partial<RequestBody>;
    const url = payload.url?.trim();

    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Segurança mínima: evita SSRF básico (recomendo manter)
    // Permite apenas http/https
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Only http/https allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = payload.method ?? "GET";

    // Headers base para a API alvo
    const forwardHeaders: Record<string, string> = {
      Accept: "application/json",
      // Se você usa ngrok para o ERP:
      "ngrok-skip-browser-warning": "true",
      ...(payload.headers ?? {}),
    };

    // Se houver body, envie como JSON (para POST/PUT)
    const hasBody = payload.body !== undefined && payload.body !== null;
    if (hasBody) {
      forwardHeaders["Content-Type"] = "application/json";
    }

    const upstream = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: hasBody ? JSON.stringify(payload.body) : undefined,
    });

    const text = await upstream.text();

    // Se upstream falhar, devolve erro com detalhes (limitado)
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          error: `Upstream returned ${upstream.status}: ${upstream.statusText}`,
          details: text?.slice(0, 3000),
        }),
        {
          status: upstream.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Tenta parsear JSON; se não for JSON, devolve como texto
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});