
import { ProviderConfigType } from '../config.js';
import { KeypaValue } from '../index.js';
import AWS from 'aws-sdk';
import { SSOClient, GetRoleCredentialsCommand } from '@aws-sdk/client-sso';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { SecretsManagerClient, ListSecretsCommand, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';



async function getSSOCredentials(profile: string) {
  const ssoCredentialProvider = fromSSO({
    profile: 'default', // or your AWS profile configured for SSO
  });

  const credentials = await ssoCredentialProvider();
  return credentials;
}

/**
 * Fetches the aws secret manager values.
 * @param config The configuration options.
 */

async function getAllSecrets<P extends 'aws-secrets-manager'>(options: ProviderConfigType<P>) {
  AWS.config.update({ region: options.region });

  const credentials = await getSSOCredentials(options.profile || 'default');

  const secretsManagerClient = new SecretsManagerClient({
    region: options.region,
    credentials, // Pass the SSO credentials to the Secrets Manager client
  });

  const secrets = [];
  let nextToken = null;

  do {
    const params: any = {
      MaxResults: 100,   // Maximum number of results to return per API call
      NextToken: nextToken,
    };

    try {
      const data = await secretsManagerClient.send(new ListSecretsCommand(params));
      nextToken = data.NextToken;

      for (const secret of (data.SecretList || [])) {
        const secretValueData = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secret.ARN }));
        secrets.push({ name: secret.Name, value: (secretValueData.SecretString || '') });
      }
    } catch (error) {
      console.error('Error retrieving secrets:', error);
      throw error;
    }
  } while (nextToken);

  return secrets;
}

export const fetch = async<P extends 'aws-secrets-manager'>(options: ProviderConfigType<P>): Promise<Record<string, KeypaValue>> => {
  console.log(`loading 'aws secret manager' secrets with options: ${JSON.stringify(options)}`)
  const secrets = (await getAllSecrets(options)).map((s: any) => ({ name: s.name, value: s.value }));
  console.log(`'aws secret manager' secrets loaded successfully! ${JSON.stringify(secrets.map((s) => s.name))}`)

  const values: Record<string, KeypaValue> = {};

  secrets.forEach((secret: any) => {
    values[secret.name] = (new KeypaValue(secret.name, secret.value, `aws-secret-manager (${options.region})`, true));
  });

  return {};
}