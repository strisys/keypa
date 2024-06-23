# keypa

## Overview

This library's purpose is to help simplify the retrieval and debugging of environment variables and secrets sourced from various providers.

```typescript
// build configurations for each environment by configure multiple providers
const builder = KeypaConfigBuilder.configure('development', 'production');

// configure 3 providers for development environment
builder.get('development').providers
       .set('dotenv': {})
       .set('azure-keyvault', { keyVaultName: 'kv-myapp-development' }})
       .set('aws-secrets-manager', { profile: 'my-profile-name', secrets: `development/keypa/config` }})

// configure 3 providers for production environment
builder.get('production').providers
       .set('dotenv': {})
       .set('azure-keyvault', { keyVaultName: 'kv-myapp-production' }})
       .set('aws-secrets-manager', { profile: 'my-profile-name', secrets: `production/keypa/config` }})

// fetch variables and secrets for development only
const kepa = builder.initialize('development');

// log info and values
const debugVal = kepa.get('debug').value;  
console.log(debugVal);             // *,-express:*,-connect:*

const dbConfig = kepa.get('aws-rds-sql');

console.log(dbConfig.name);        // db-server
console.log(dbConfig.value);       // my-database.000000000000.us-east-1.rds.amazonaws.com
console.log(dbConfig.source);      // aws-secret-manager

```

### Providers

A provider is that which from environment variables and secrets can be sourced from.  These are configured in example code in the last section for each environment.  Currently, the libary supports [dotenv](https://github.com/motdotla/dotenv), [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/), and [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/) as providers.  With respect to the last two, access is secured by the cloud provider and the necessary configurations will need to be set.  Below are sample CLI commands for logging into Azure and AWS respectively using SSO.

**Azure CLI SSO**

```
az login
```

**AWS CLI SSO**

```
aws sso login --profile my-profile-name
```
