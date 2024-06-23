import { initialize as processEnvInitialize } from "./process-env-provider.js";
import { initialize as dotEnvInitialize } from "./dotenv-provider.js";
import { initialize as azureKeyVaultInitialize } from "./azure-keyvault-provider.js";
import { ProviderType } from "../config.js";

const initializeMap: Record<ProviderType, any> = {
  ['process.env']: processEnvInitialize,
  ['dotenv']: dotEnvInitialize,
  ['azure-keyvault']: azureKeyVaultInitialize,
  ['aws-secret-manager']: null
};

export const getInitializer = (provider: ProviderType) => {
  return initializeMap[provider];
}