import { cookies } from "next/headers";
import { loadConfig } from "../src/config.js";
import { getData } from "../src/app.js";
import { readSession } from "../src/web/auth.js";
import { dispatch, webConfigFrom } from "../src/web/dispatch.js";
import { Casa } from "./components/casa";
import { isHouse, type House, type Names } from "./types";

export const dynamic = "force-dynamic";

const fallbackNames: Names = { lucasName: "Lucas", giName: "Gi" };

export default async function Page() {
  const names = readNames();
  const token = (await cookies()).get("casa")?.value;
  return <Casa names={names} initialHouse={token ? await houseFor(token) : null} />;
}

async function houseFor(token: string): Promise<House | null> {
  try {
    const data = await getData();
    const config = webConfigFrom(data.config, process.env.WEB_PASSWORD);
    if (!readSession(token, config.webPassword)) return null;
    const result = await dispatch(
      {
        method: "GET",
        op: "home",
        cookie: token,
        body: {},
        ip: "page",
        now: Date.now(),
        secure: true,
      },
      { config, store: data.store },
    );
    return isHouse(result.body) ? result.body : null;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return null;
  }
}

function readNames(): Names {
  try {
    const config = loadConfig();
    return { lucasName: config.lucasName, giName: config.giName };
  } catch {
    return fallbackNames;
  }
}
