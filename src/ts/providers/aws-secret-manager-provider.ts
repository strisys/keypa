
import { ProviderConfigType } from '../config.js';
import { KeypaValue } from '../index.js';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { fromIni } from '@aws-sdk/credential-providers';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SecretsManagerClient, ListSecretsCommand, GetSecretValueCommand, SecretListEntry, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';

type AwsProviderConfigType = ProviderConfigType<'aws-secrets-manager'>;

const isRunningInAWS = (): boolean => {
  return !!process.env.AWS_EXECUTION_ENV ||
    !!process.env.AWS_REGION ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.ECS_CONTAINER_METADATA_URI ||
    !!process.env.ECS_CONTAINER_METADATA_URI_V4 ||
    !!process.env.KUBERNETES_SERVICE_HOST ||
    require('fs').existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
}

class SecretStore {
  private _client: (SecretsManagerClient | null) = null;
  private _options: AwsProviderConfigType;

  constructor(options: AwsProviderConfigType) {
    this._options = options;
  }

  private async getCredentials(): Promise<any> {
    const config = {
      profile: (this._options.profile || 'default')
    }

    let provider: any;

    try {
      console.log(`attempting to get credentials from SSO (${config.profile}) ...`);
      provider = fromSSO(config);
      console.log(`using credentials from SSO (${config.profile})`);
    }
    catch (error) {
      console.warn(`failed to get credentials from SSO (${config.profile}).  attempting to get credentials from ini. ${error}`);
    }

    if (!provider) {
      try {
        console.log(`attempting to get credentials from ini (${config.profile}) ...`);
        provider = fromIni(config);
        console.log(`using credentials from ini (${config.profile})`);
      }
      catch (error) {
        console.warn(`failed to get credentials from ini (${config.profile}). ${error}`);
      }
    }

    if ((!provider) && (!isRunningInAWS())) {
      throw new Error(`Failed to get credentials from SSO or ini (${config.profile}).`)
    }

    console.log(`using default credential provider chain ...`);
    provider = defaultProvider();

    return (await provider());
  }

  private async tryGetClient(): Promise<SecretsManagerClient> {
    if (this._client) {
      return this._client;
    }

    try {
      console.log(`creating AWS secrets manager client ...`);

      const credentials = (await this.getCredentials());

      this._client = new SecretsManagerClient({
        credentials,
      });

      console.log(`AWS secrets manager created successfully!`);

      return this._client;
    }
    catch (error) {
      const message = `Failed to create AWS secrets manager. ${error}`;
      console.error(message);

      throw new Error(message);
    }
  }

  private async getAllSecrets(): Promise<Array<SecretListEntry>> {
    const client = (await this.tryGetClient());

    const secrets: Array<SecretListEntry> = [];
    let nextToken = null;

    do {
      const params: any = {
        MaxResults: 100,
        NextToken: nextToken,
      };

      try {
        const data = (await client.send(new ListSecretsCommand(params)));
        nextToken = data.NextToken;

        for (const secret of (data.SecretList || []).filter((s) => Boolean(s.Name))) {
          if (secret.Name) {
            secrets.push(secret);
          }
        }
      }
      catch (error) {
        const message = `Error retrieving list of all secrets.  Its possible the current user does not have the rights to list all secrents.  Change the configuration to pass in specific secrets to extract values from. ${error}`;
        console.error(error);
        throw new Error(message);
      }
    } while (nextToken);

    return secrets.filter((s) => Boolean(s.ARN));
  }

  private async getSecretValue(secretIdentitfier: string): Promise<GetSecretValueCommandOutput> {
    try {
      const client = (await this.tryGetClient());
      return (await client.send(new GetSecretValueCommand({ SecretId: secretIdentitfier })));
    }
    catch (error) {
      throw new Error(`Error retrieving AWS secret: ${secretIdentitfier}. ${error}`);
    }
  }

  public async getAll(): Promise<Array<{ name: string, value: string, source: string }>> {
    const secretNames = (Array.isArray(this._options.secrets) ? this._options.secrets : ((typeof this._options.secrets === 'string') ? [this._options.secrets] : []));
    const values: Array<{ name: string, value: string, source: string }> = [];

    const parseSecretValue = (secretIdentifier: string, secretValueData: GetSecretValueCommandOutput): void => {
      const kv = JSON.parse((secretValueData.SecretString || '{}'));

      Object.keys(kv).forEach((key) => {
        values.push({ name: key, value: kv[key], source: secretIdentifier });
      });
    };

    const getSecretIdentitiers = async (): Promise<Array<string>> => {
      return ((secretNames.length) ? secretNames : (await this.getAllSecrets()).map((s) => (s.ARN || '')));
    }

    for (const secretIdentiifer of (await getSecretIdentitiers())) {
      parseSecretValue(secretIdentiifer, (await this.getSecretValue(secretIdentiifer)));
    }

    return values;
  }
}

export const fetch = async (options: AwsProviderConfigType): Promise<Record<string, KeypaValue>> => {
  console.log(`loading secrets from 'AWS secret manager': ${JSON.stringify(options)}`)
  const secrets = await (new SecretStore(options)).getAll();
  console.log(`'AWS secret manager' secrets (${secrets.length}) loaded successfully! ${JSON.stringify(secrets.map((s) => s.name))}`)

  return secrets.reduce((accumulator: Record<string, KeypaValue>, secret: { name: string, value: string, source: string }) => {
    accumulator[secret.name] = new KeypaValue(secret.name, secret.value, `aws-secret-manager (${secret.source})`, true);
    return accumulator;
  }, {});
}