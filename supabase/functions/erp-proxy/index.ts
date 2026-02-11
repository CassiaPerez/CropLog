import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ProxyRequestBody {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  page?: number;
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function buildUrlWithParams(baseUrl: string, page?: number): string {
  try {
    const url = new URL(baseUrl);

    if (page !== undefined) {
      url.searchParams.set('page', page.toString());
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as Partial<ProxyRequestBody>;
    const baseUrl = (payload.url ?? "").trim();
    const method: HttpMethod = (payload.method ?? "GET") as HttpMethod;
    const page = payload.page;

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isHttpUrl(baseUrl)) {
      return new Response(JSON.stringify({ error: "Invalid URL (only http/https)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalUrl = buildUrlWithParams(baseUrl, page);

    const forwardHeaders: Record<string, string> = {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(payload.headers ?? {}),
    };

    const hasBody = payload.body !== undefined && payload.body !== null;

    if (hasBody) {
      forwardHeaders["Content-Type"] = forwardHeaders["Content-Type"] ?? "application/json";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const upstream = await fetch(finalUrl, {
        method,
        headers: forwardHeaders,
        body: hasBody ? JSON.stringify(payload.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await upstream.text();

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
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: "Request timeout after 30 seconds" }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }
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
