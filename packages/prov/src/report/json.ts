import type { Reporter } from "./types.js";

export function createJsonReporter(): Reporter {
  return {
    onFlowPass(result) {
      console.log(JSON.stringify({ event: "flowPass", ...result }));
    },

    onFlowFail(result) {
      console.log(JSON.stringify({ event: "flowFail", ...result }));
    },

    onRunComplete(summary) {
      console.log(JSON.stringify({ event: "runComplete", ...summary }));
    },
  };
}
