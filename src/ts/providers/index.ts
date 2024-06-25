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

export class ProviderLoader {
  private _providerType: ProviderType;

  public constructor(provider: ProviderType) {
    this._providerType = provider;
  }

  public getFetchFn() {
    return initializeMap[this._providerType];
  }

  public get isAsync(): boolean {
    return (this.getFetchFn().constructor.name === 'AsyncFunction');
  }

  public get isSync(): boolean {
    return (!this.isAsync);
  }
}

export const getLoader = (provider: ProviderType): ProviderLoader => {
  return (new ProviderLoader(provider));
}