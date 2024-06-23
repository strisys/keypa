# keypa

## Overview

This library's purpose is to help simplify the retrieval and debugging of environment variables and secret sourced from various providers.

```typescript
// build configurations for each environment
const builder = KeypaConfigBuilder.configure('development', 'production');

// set the providers for values
builder.get('development').providers
       .set('dotenv': {})
       .set('azure-keyvault', { keyVaultName: 'kv-myapp-development' }})
       .set('aws-secret-manager', { region: 'us-east-1' }})

builder.get('production').providers
       .set('dotenv': {})
       .set('azure-keyvault', { keyVaultName: 'kv-myapp-production' }})
       .set('aws-secret-manager', { region: 'us-east-2' }})

// initialize 
const kepa = builder.initialize('development');

const debugVal = kepa.get('debug').value;  
console.log(debugVal);             // *,-express:*,-connect:*

const dbConfig = kepa.get('db-server');

console.log(dbConfig.name);        // db-server
console.log(dbConfig.value);       // my-database.000000000000.us-east-1.rds.amazonaws.com
console.log(dbConfig.source);      // aws-secret-manager

```
