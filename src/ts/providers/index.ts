import { fetch as processEnvFetch } from "./process-env-provider.js";
import { fetch as dotEnvFetch } from "./dotenv-provider.js";
import { fetch as azureKeyVaultFetch } from "./azure-keyvault-provider.js";
import { fetch as awsSecretManagerFetch } from "./aws-secret-manager-provider.js";
import { ProviderType } from "../config.js";

const initializeMap: Record<ProviderType, any> = {
  ['process.env']: processEnvFetch,
  ['dotenv']: dotEnvFetch,
  ['azure-keyvault']: azureKeyVaultFetch,
  ['aws-secrets-manager']: awsSecretManagerFetch
};

export const getProviderFetch = (provider: ProviderType) => {
  return initializeMap[provider];
}