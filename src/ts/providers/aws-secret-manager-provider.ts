
import { SecretsManagerClient, ListSecretsCommand, GetSecretValueCommand, SecretListEntry, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { ProviderConfigType } from '../config.js';
import { KeypaValue } from '../index.js';

type AwsProviderConfigType = ProviderConfigType<'aws-secrets-manager'>;

class SecretStore {
  private _client: (SecretsManagerClient | null) = null;
  private _options: AwsProviderConfigType;

  constructor(options: AwsProviderConfigType) {
    this._options = options;
  }

  private async tryGetClient(): Promise<SecretsManagerClient> {
    if (this._client) {
      return this._client;
    }

    try {
      console.log(`creating AWS secrets manager client ...`);

      const getCredentials = async (): Promise<any> => {
        let config = ((this._options.profile) ? { profile: (this._options.profile || 'default') } : {});

        // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html
        console.log(`using default credential provider chain (${config.profile}) ...`);
        const provider = defaultProvider(config);

        return (await provider());
      }

      const region = (this._options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION);
      console.log(`creating secrets manager client (region:=${region || ''})...`);

      let secretManagerParams: any = {
        credentials: (await getCredentials()),
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 5000,
          socketTimeout: 5000
        })
      }

      secretManagerParams = ((region) ? { ...secretManagerParams, region } : secretManagerParams);

      const client = (this._client = new SecretsManagerClient(secretManagerParams));
      console.log(`AWS secrets manager created successfully!`);

      return client
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

      console.log(`fetching AWS secret (secret-id:${secretIdentitfier})...`);
      const val = (await client.send(new GetSecretValueCommand({ SecretId: secretIdentitfier })));
      console.log(`AWS secret (secret-id:${secretIdentitfier}) fetched successfully!`);

      return val
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