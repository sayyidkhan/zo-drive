import type { ZoDriveClient } from "@zo-drive/sdk";

type FunctionClientMethod =
  | "createFunction"
  | "deleteFunction"
  | "listFunctions"
  | "listFunctionRuns"
  | "runFunction"
  | "updateFunction";

export type FunctionsClient = Partial<Pick<ZoDriveClient, FunctionClientMethod>>;

export type ReadyFunctionsClient = Required<FunctionsClient>;

export function supportsFunctions(
  client: FunctionsClient
): client is ReadyFunctionsClient {
  return Boolean(
    client.createFunction
      && client.deleteFunction
      && client.listFunctions
      && client.listFunctionRuns
      && client.runFunction
      && client.updateFunction
  );
}
