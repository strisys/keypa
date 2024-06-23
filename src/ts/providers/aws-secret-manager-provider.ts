
import { ProviderConfigType } from '../config.js';
import { KeypaValue } from '../index.js';
import AWS from 'aws-sdk';
import { fromSSO } from '@aws-sdk/credential-provider-sso'; // Import the AwsCredentialIdentity type
import { SecretsManagerClient, ListSecretsCommand, GetSecretValueCommand, SecretListEntry, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';

type AwsProviderConfigType = ProviderConfigType<'aws-secrets-manager'>;

class SecretStore {
  private _client: (SecretsManagerClient | null) = null;
  private _options: AwsProviderConfigType;

  constructor(options: AwsProviderConfigType) {
    this._options = options;
  }

  private async getCredentials(): Promise<any> {
    const profile = (this._options.ssoProfile || 'default');
    console.log(`get credentials for AWS secrets manager client (profile=${profile})...`);

    const ssoCredentialProvider = fromSSO({
      profile: (this._options.ssoProfile || 'default')
    });

    return (await ssoCredentialProvider());
  }

  private async tryGetClient(): Promise<SecretsManagerClient> {
    if (this._client) {
      return this._client;
    }

    try {
      console.log(`creating AWS secrets manager client ...`);

      const credentials = (await this.getCredentials());

      this._client = new SecretsManagerClient({
        // region: options.region,
        credentials,
      });


      console.log(`AWS secrets manager created successfully!`);

      return this._client;
    }
    catch (err) {
      const message = `Failed to create AWS secrets manager created. ${err}`;
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
      } catch (error) {
        console.error('Error retrieving list of all secrets.  Its possible the current user does not have the rights to list all secrents.  Change the configuration to pass in specific secret names.', error);
        throw error;
      }
    } while (nextToken);

    return secrets;
  }

  public async getAll(): Promise<Array<{ name: string, value: string }>> {
    const client = (await this.tryGetClient());
    const values: Array<{ name: string, value: string }> = [];
    const secretNames = (Array.isArray(this._options.secrets) ? this._options.secrets : ((typeof this._options.secrets === 'string') ? [this._options.secrets] : []));

    const parseSecretValue = (secretValueData: GetSecretValueCommandOutput): void => {
      const kv = JSON.parse((secretValueData.SecretString || '{}'));

      Object.keys(kv).forEach((key) => {
        values.push({ name: key, value: kv[key] });
      });
    };

    if (!secretNames.length) {
      try {
        const secrets = (await this.getAllSecrets());

        for (const secret of secrets) {
          const secretValueData = (await client.send(new GetSecretValueCommand({ SecretId: secret.ARN })));
          parseSecretValue(secretValueData);
        }
      } catch (error) {
        console.error('Error retrieving secrets:', error);
        throw error;
      }

      return values;
    }

    for (const secretName of secretNames) {
      try {
        const secretValueData = (await client.send(new GetSecretValueCommand({ SecretId: secretName })));
        parseSecretValue(secretValueData);
      } catch (error) {
        console.error('Error retrieving secrets:', error);
        throw error;
      }
    }

    return values;
  }
}


// const getCredentials = async (options: AwsProviderConfigType): Promise<any> => {
//   const ssoCredentialProvider = fromSSO({
//     profile: options.ssoProfile || 'default'
//   });

//   return (await ssoCredentialProvider());
// }



// const getAllSecrets = async (options: AwsProviderConfigType): Promise<Array<{ name: string, value: string }>> => {
//   const credentials = await getSSOCredentials(options);

//   const secretsManagerClient = new SecretsManagerClient({
//     // region: options.region,
//     credentials,
//   });

//   const secrets = [];
//   let nextToken = null;

//   do {
//     const params: any = {
//       MaxResults: 100,
//       NextToken: nextToken,
//     };

//     try {
//       const data = (await secretsManagerClient.send(new ListSecretsCommand(params)));
//       nextToken = data.NextToken;

//       for (const secret of (data.SecretList || [])) {
//         const secretValueData = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secret.ARN }));
//         secrets.push({ name: (secret.Name || 'unknown'), value: (secretValueData.SecretString || '') });
//       }
//     } catch (error) {
//       console.error('Error retrieving secrets:', error);
//       throw error;
//     }
//   } while (nextToken);

//   return secrets;
// }

export const fetch = async (options: AwsProviderConfigType): Promise<Record<string, KeypaValue>> => {
  console.log(`loading secrets from 'aws secret manager': ${JSON.stringify(options)}`)
  const secrets = await (new SecretStore(options)).getAll();
  console.log(`'aws secret manager' secrets (${secrets.length}) loaded successfully! ${JSON.stringify(secrets.map((s) => s.name))}`)

  return secrets.reduce((accumulator: Record<string, KeypaValue>, secret: { name: string, value: string }) => {
    accumulator[secret.name] = new KeypaValue(secret.name, secret.value, `aws-secret-manager (${AWS.config.region})`, true);
    return accumulator;
  }, {});
}