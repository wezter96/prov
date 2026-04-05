import type { StudioRouter } from "../../../../packages/spana/src/studio/api.js";
import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

const link = new RPCLink({
  url: new URL("/rpc", window.location.origin).href,
});

export const client: RouterClient<StudioRouter> = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
