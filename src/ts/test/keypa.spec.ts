import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import { Keypa, KeypaConfigBuilder, KeypaProviderConfig } from '../index.js';

const getEnvFilePath = () => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  return path.resolve(dirname, '.env-keypa');
}

describe('KepaConfigBuilder', () => {
  describe('configure', function () {
    it('should return a valid instance with all specified environments', async () => {
      // Assemble / Arrange
      const environments = ['development', 'production'];
      const builder = Keypa.configure(environments[0], environments[1]);

      // Assert
      expect(builder).to.be.instanceOf(KeypaConfigBuilder);
      expect(builder.environments).to.have.length(environments.length);

      environments.forEach((env) => {
        expect(builder.environments).to.include(env);
        expect(builder.get(env)).to.be.instanceOf(KeypaProviderConfig);
      });
    });

    it(`should return a valid instance with 3 'stardard' environments when none are passed`, async () => {
      // Assemble / Arrange
      const builder = Keypa.configure();
      const environments = ['development', 'staging', 'production'];

      // Assert
      expect(builder).to.be.instanceOf(KeypaConfigBuilder);
      expect(builder.environments).to.have.length(environments.length);

      environments.forEach((env) => {
        expect(builder.environments).to.include(env);
        expect(builder.get(env)).to.be.instanceOf(KeypaProviderConfig);
      });
    });
  });

  describe('Kepa', () => {
    describe('initialize', function () {
      it(`should be able to configure dotenv to read from the .env file`, async () => {
        this.timeout(15000);

        // Assemble
        const environments = ['development', 'production'];
        const currentEnvironment = environments[0];
        const builder = KeypaConfigBuilder.configure(environments[0], environments[1]);

        Keypa.dispose();

        const v = getEnvFilePath();

        const dotEnvConfig = {
          path: getEnvFilePath(),
          debug: true,
        }

        // Arrange
        builder.get(environments[0]).providers
          .set('dotenv', dotEnvConfig);

        builder.get(environments[1]).providers
          .set('dotenv', dotEnvConfig);

        const keypa = await builder.initialize(currentEnvironment)

        expect(keypa).to.be.instanceOf(Keypa);
        expect(keypa === Keypa.current).to.be.true;

        // Assert
        const valConfig = keypa.get('TEST_VALUE');

        expect(valConfig.value).to.be.equal('Keypa');
        expect(valConfig.name).to.be.equal('TEST_VALUE');
        expect(valConfig.source.includes('.env')).to.be.true;
      });

      it(`should be able to configure dotenv and azure key vault`, async () => {
        this.timeout(15000);

        // Assemble
        const environments = ['development', 'production'];
        const currentEnvironment = environments[0];
        const builder = KeypaConfigBuilder.configure(environments[0], environments[1]);

        Keypa.dispose();

        const dotEnvConfig = {
          path: getEnvFilePath(),
          debug: true,
        }

        const azureConfig = {
          keyVaultName: 'kv-keypa-development',
        }

        // Arrange
        builder.get(environments[0]).providers
          .set('dotenv', dotEnvConfig)
          .set('azure-keyvault', azureConfig);

        builder.get(environments[1]).providers
          .set('dotenv', dotEnvConfig)
          .set('azure-keyvault', azureConfig);

        const keypa = await builder.initialize(currentEnvironment)

        expect(keypa).to.be.instanceOf(Keypa);
        expect(keypa === Keypa.current).to.be.true;

        let valConfig = keypa.get('TEST_VALUE');

        expect(valConfig.value).to.be.equal('Keypa');
        expect(valConfig.name).to.be.equal('TEST_VALUE');
        expect(valConfig.isSecret).to.be.false;

        valConfig = keypa.get('AZURE-KEYPA-TEST');

        expect(valConfig.name).to.be.equal('AZURE-KEYPA-TEST');
        expect(valConfig.value).to.be.equal('banana');
        expect(valConfig.source.includes('azure')).to.be.true;
        expect(valConfig.source.includes('kv-keypa-development')).to.be.true;
        expect(valConfig.isSecret).to.be.true;
      });

      it(`should be able to configure dotenv, azure key vault, and aws secret manager`, async () => {
        this.timeout(15000);

        // Assemble
        const environments = ['development', 'production'];
        const currentEnvironment = environments[0];
        const builder = KeypaConfigBuilder.configure(environments[0], environments[1]);

        Keypa.dispose();

        const dotEnvConfig = {
          path: getEnvFilePath(),
          debug: true,
        }

        const azureConfig = {
          keyVaultName: 'kv-keypa-development',
        }

        const awsConfig = {
          profile: 'playground',
        }

        // Arrange
        builder.get(environments[0]).providers
          .set('dotenv', dotEnvConfig)
          .set('azure-keyvault', azureConfig)
          .set('aws-secrets-manager', { ...awsConfig, secrets: `${environments[0]}/keypa/config` });

        builder.get(environments[1]).providers
          .set('dotenv', dotEnvConfig)
          .set('azure-keyvault', azureConfig)
          .set('aws-secrets-manager', { ...awsConfig, secrets: `${environments[1]}/keypa/config` });

        const keypa = await builder.initialize(currentEnvironment)

        expect(keypa).to.be.instanceOf(Keypa);
        expect(keypa === Keypa.current).to.be.true;

        let valConfig = keypa.get('TEST_VALUE');

        expect(valConfig.value).to.be.equal('Keypa');
        expect(valConfig.name).to.be.equal('TEST_VALUE');
        expect(valConfig.isSecret).to.be.false;

        valConfig = keypa.get('AZURE-KEYPA-TEST');

        expect(valConfig.name).to.be.equal('AZURE-KEYPA-TEST');
        expect(valConfig.value).to.be.equal('banana');
        expect(valConfig.source.includes('azure')).to.be.true;
        expect(valConfig.source.includes('kv-keypa-development')).to.be.true;
        expect(valConfig.isSecret).to.be.true;

        valConfig = keypa.get(`AWS_KEYPA_TEST`);

        expect(valConfig.name).to.be.equal('AWS_KEYPA_TEST');
        expect(valConfig.value).to.be.equal('blueberry');
        expect(valConfig.source.includes('aws')).to.be.true;
        expect(valConfig.isSecret).to.be.true;
      });
    });
  });
});