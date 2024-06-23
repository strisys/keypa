import { expect } from 'chai';
import { Keypa, KeypaConfigBuilder, KeypaProviderConfig } from '../index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current module's file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


describe('KepaConfigBuilder', () => {
  describe('build', function () {
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

    it(`should be able to configure dotenv to read from the .env file`, async () => {
      this.timeout(15000);

      // Assemble
      const environments = ['development', 'production'];
      const currentEnvironment = environments[0];
      const builder = KeypaConfigBuilder.configure(environments[0], environments[1]);

      Keypa.dispose();

      const dotEnvConfig = {
        path: path.resolve(__dirname, '.env'),
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
      expect(valConfig.source).to.be.equal('dotenv');
    });

    it(`should be able to configure dotenv and azure key vault`, async () => {
      this.timeout(15000);

      // Assemble
      const environments = ['development', 'production'];
      const currentEnvironment = environments[0];
      const builder = KeypaConfigBuilder.configure(environments[0], environments[1]);

      Keypa.dispose();

      const dotEnvConfig = {
        path: path.resolve(__dirname, '.env'),
        debug: true,
      }

      const azureConfig = {
        keyVaultName: 'kv-webappquickstart',
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

      valConfig = keypa.get('KEYPA-TEST-SECRET');

      expect(valConfig.value).to.be.equal('12345');
      expect(valConfig.name).to.be.equal('KEYPA-TEST-SECRET');
      expect(valConfig.source.includes('kv-webappquickstart')).to.be.true;
    });
  });
});