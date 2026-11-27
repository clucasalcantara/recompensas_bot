import { getData } from "../../../src/app.js";
import { webConfigFrom } from "../../../src/web/dispatch.js";
import { handleWebRequest } from "../../../src/web/http.js";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

async function respond(req: Request): Promise<Response> {
  try {
    const data = await getData();
    return handleWebRequest(req, {
      config: webConfigFrom(data.config, process.env.WEB_PASSWORD),
      store: data.store,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return Response.json({ error: "A casa não abriu." }, { status: 500 });
  }
}

export const GET = respond;
export const POST = respond;
