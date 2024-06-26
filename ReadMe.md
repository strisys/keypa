# keypa

## Philosophy

Application variables and secrets are conceptually related, with the difference that the latter needs to be secured. Ultimately, these variables end up in memory to be used by an application.  The purpose of this library is to simplify the acquisition and debugging of environment variables and secrets in two execution contexts: locally and in the cloud.

## Sample

The example below uses the builder pattern and chaining to configure the providers of variables and secrets. Once configured, initialization for the current environment will fetch and store those values for the application's use.

```typescript
// build configurations for each environment by configure multiple providers
const builder = KeypaConfigBuilder.configure('development', 'production');

// configure 3 providers for development environment
builder.get('development').providers
  .set('dotenv', {})
  .set('azure-keyvault', { keyVaultName: 'kv-myapp-development' })
  .set('aws-secrets-manager', { profile: 'my-profile-name', secrets: `development/keypa/config` })

// configure 3 providers for production environment
builder.get('production').providers
  .set('dotenv', {})
  .set('azure-keyvault', { keyVaultName: 'kv-myapp-production' })
  .set('aws-secrets-manager', { profile: 'my-profile-name', secrets: `production/keypa/config` })

// fetch variables and secrets for development only
const kepa = await builder.initialize('development');

// log info and values
const debugVal = kepa.get('debug').value;
console.log(debugVal);             // *,-express:*,-connect:*

const dbConfig = kepa.get('aws-rds-sql');

```

At the end of the initialization process, a table detailing what variables and secrets are available, where they come from, and whether there are duplicates between sources to be aware of is written to the standard output. 

```
+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
¦ (index) ¦ environment   ¦ name                              ¦ source                                                       ¦ isSecret ¦ duplicates ¦ value                                ¦
+---------+---------------+-----------------------------------+--------------------------------------------------------------+----------+------------+--------------------------------------¦
¦ 0       ¦ 'development' ¦ 'ALLUSERSPROFILE'                 ¦ 'process.env'                                                ¦ false    ¦ 0          ¦ 'C:\\ProgramData'                    ¦
¦ 1       ¦ 'development' ¦ 'APPDATA'                         ¦ 'process.env'                                                ¦ false    ¦ 0          ¦ 'C:\\Users\\micro\\AppData\\Roam...' ¦
¦ 2       ¦ 'development' ¦ 'AWS_PROFILE'                     ¦ 'process.env'                                                ¦ false    ¦ 0          ¦ 'playground'                         ¦
...
¦ 54      ¦ 'development' ¦ 'OS'                              ¦ 'process.env'                                                ¦ false    ¦ 0          ¦ 'Windows_NT'                         ¦
¦ 95      ¦ 'development' ¦ 'windir'                          ¦ 'process.env'                                                ¦ false    ¦ 0          ¦ 'C:\\Windows'                        ¦
¦ 96      ¦ 'development' ¦ 'TEST_VALUE'                      ¦ 'dotenv (F:\\my_projects\\keypa\\src\\js\\test\\.env-keypa)' ¦ false    ¦ 0          ¦ 'Keypa'                              ¦
¦ 97      ¦ 'development' ¦ 'AZURE-KEYPA-TEST'                ¦ 'azure-keyvault (kv-keypa-development)'                      ¦ true     ¦ 0          ¦ '******'                             ¦
¦ 98      ¦ 'development' ¦ 'AWS_KEYPA_TEST'                  ¦ 'aws-secret-manager (development/keypa/config)'              ¦ true     ¦ 0          ¦ '*********'                          ¦
+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

### Providers

A provider is that which from environment variables and secrets can be sourced from and current the library supports [dotenv](https://github.com/motdotla/dotenv), [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/), and [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/).  These providers are configured in the example code in the last section for each environment.

With respect to [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/) and [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/), access is secured by each cloud provider and the necessary configurations will need to be set for local development and cloud execution.  Below are sample CLI commands for logging into Azure and AWS respectively using SSO in the context of local development. The identity of the process when executing in the cloud is established by the cloud provider.

```powershell
# azure cli
az login

# aws cli
aws sso login --profile playground
```

