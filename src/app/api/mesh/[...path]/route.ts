// The DoomsdAI server (8787) has /mesh/* routes that proxy to the BitChat
// bridge (8793). When running Next.js alongside that server, we proxy to 8787.
// When running Next.js standalone, set MESH_UPSTREAM to http://127.0.0.1:8793
// to hit the bridge directly.
const UPSTREAM = process.env.MESH_UPSTREAM ?? "http://127.0.0.1:8787";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${UPSTREAM}/mesh/${path.join("/")}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method !== "GET" ? await req.text() : undefined,
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "Bridge unavailable" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
