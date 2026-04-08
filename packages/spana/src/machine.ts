export const MACHINE_SCHEMA_VERSION = 1 as const;

const DOCS_ROOT = "https://wezter96.github.io/spana";

export function buildDocsUrl(path: string): string {
  return `${DOCS_ROOT}${path}`;
}

interface MachineError {
  errorCode: string;
  message: string;
  suggestedFix?: string;
  docsUrl?: string;
}

interface MachinePayload {
  schemaVersion: number;
  command: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: MachineError;
}

export function createMachineSuccess(
  command: string,
  data: Record<string, unknown>,
): MachinePayload {
  return { schemaVersion: MACHINE_SCHEMA_VERSION, command, success: true, data };
}

export function createMachineFailure(command: string, error: MachineError): MachinePayload {
  return { schemaVersion: MACHINE_SCHEMA_VERSION, command, success: false, error };
}

export function printMachinePayload(payload: MachinePayload, pretty?: boolean): void {
  console.log(pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload));
}
