import { ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential, EnvironmentCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { ProviderConfigType } from '../config.js';
import { KeypaValue } from '../index.js';

type AzureProviderConfigType = ProviderConfigType<'azure-keyvault'>;

class KeyVaultStore {
  private _client: (SecretClient | null) = null;
  private _options: AzureProviderConfigType;
  private _url: string = '';

  constructor(options: AzureProviderConfigType) {
    this._options = options;
  }

  public get url(): string {
    return (this._url || (this._url = `https://${this._options.keyVaultName}.vault.azure.net`));
  }

  private tryGetClient(): SecretClient {
    if (this._client) {
      return this._client;
    }

    try {
      console.log(`creating Azure key vault client (${this.url}) ...`);

      const credentials = (this._options.tokenCredentials || [new AzureCliCredential(), new EnvironmentCredential(), new ManagedIdentityCredential()]);

      const credential = new ChainedTokenCredential(...credentials);
      this._client = new SecretClient(this.url, credential);

      console.log(`Azure key vault client (${this.url}) created successfully!`);

      return this._client;
    }
    catch (err) {
      const message = `Failed to create Azure Key Vault client (${this.url}). Could not create secret client. ${err}`;
      console.error(message);

      throw new Error(message);
    }
  }

  public async getAll(): Promise<Array<{ name: string, value: string }>> {
    const client = this.tryGetClient();
    const secrets = [];

    for await (const secretProperties of client.listPropertiesOfSecrets()) {
      const secret = await client.getSecret(secretProperties.name);
      secrets.push({ name: secret.name, value: (secret.value || '') });
    }

    return secrets;
  }
}

/**
 * Initializes the azure key-vault configuration.
 * @param config The configuration options.
 */
export const fetch = async (options: AzureProviderConfigType): Promise<Record<string, KeypaValue>> => {
  const kv = new KeyVaultStore(options);

  console.log(`loading 'azure key vault' secrets with options: ${options.keyVaultName}`)
  const secrets = (await kv.getAll());
  console.log(`'azure key vault' secrets loaded successfully! ${JSON.stringify(secrets.map((s) => s.name))}`)

  const values: Record<string, KeypaValue> = {};

  secrets.forEach((secret) => {
    values[secret.name] = (new KeypaValue(secret.name, secret.value, `azure-keyvault (${options.keyVaultName})`, true));
  });

  return values;
}