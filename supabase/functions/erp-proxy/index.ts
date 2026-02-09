// supabase/functions/erp-proxy/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * CORS “à prova de preflight”
 * - Em DEV: "*" (origens mudam muito, ex. webcontainer)
 * - Em PROD: troque por seu domínio (ex.: https://intranet.grupocropfield.com.br)
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, origin",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ProxyRequestBody {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

serve(async (req) => {
  // ✅ Preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Aceitamos somente POST para o proxy (mais seguro)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Partial<ProxyRequestBody>;
    const url = (payload.url ?? "").trim();
    const method: HttpMethod = (payload.method ?? "GET") as HttpMethod;

    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Segurança básica: só http/https
    if (!isHttpUrl(url)) {
      return new Response(JSON.stringify({ error: "Invalid URL (only http/https)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Headers base enviados para a API de destino
    const forwardHeaders: Record<string, string> = {
      Accept: "application/json",
      // útil quando o seu ERP está atrás de ngrok
      "ngrok-skip-browser-warning": "true",
      ...(payload.headers ?? {}),
    };

    const hasBody = payload.body !== undefined && payload.body !== null;

    if (hasBody) {
      forwardHeaders["Content-Type"] = forwardHeaders["Content-Type"] ?? "application/json";
    }

    const upstream = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: hasBody ? JSON.stringify(payload.body) : undefined,
    });

    const text = await upstream.text();

    // Se upstream falhar, devolve erro com detalhes para debug
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

    // Tenta parsear JSON; se não for, devolve texto
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
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});