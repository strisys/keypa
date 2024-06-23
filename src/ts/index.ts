import { KeypaConfigBuilder, KeypaProviderConfig, ProviderType } from './config.js';
import { getProviderFetch } from './providers/index.js';
import { KeypaValueCache, KeypaValue } from './value.js';


export { KeypaConfigBuilder, KeypaProviderConfig, KeypaValue };
export type { ProviderType };


export class Keypa {
  private static _instance: (Keypa | null) = null;
  private readonly _builder: KeypaConfigBuilder;
  private _envCache: KeypaValueCache = new KeypaValueCache('unknown', {});

  private constructor(builder: KeypaConfigBuilder) {
    this._builder = builder;
    Keypa._instance = this;
  }

  public log(format: ('json' | 'table')): Keypa {
    const rows: Array<{}> = [];

    if (!this._envCache) {
      return this;
    }

    this._envCache.toJson().forEach((row) => rows.push(row));

    if (format === 'json') {
      console.log(JSON.stringify(rows));
      return this;
    }

    console.table(rows);
    return this;
  }

  public get builder(): KeypaConfigBuilder {
    return this._builder.setAsReadonly();
  }

  public static configure(...environments: Array<string>): KeypaConfigBuilder {
    return KeypaConfigBuilder.configure(...environments);
  }

  public get environment(): string {
    return (Keypa.current._envCache?.environment || 'unknown');
  }

  public tryGet(name: string): KeypaValue {
    return Keypa.current._envCache?.tryGet(name);
  }

  public get(name: string): KeypaValue {
    return this._envCache.get(name);
  }

  public toJson(): Array<{}> {
    return this._envCache.toJson();
  }

  public static get current(): Keypa {
    if (!Keypa._instance) {
      throw new Error('Keypa is not initialized.');
    }

    return Keypa._instance;
  }

  public static dispose(): void {
    Keypa._instance = null;
  }

  public static async initialize(builder: KeypaConfigBuilder, environment: string): Promise<Keypa> {
    if (Keypa._instance) {
      throw new Error('Keypa is already initialized.');
    }

    const instance = new Keypa(builder);
    const result: Record<string, KeypaValue> = {};

    const hydrate = (values: Record<string, KeypaValue>) => {
      Object.keys(values).forEach((key) => {
        if (!result[key]) {
          result[key] = values[key];
          return;
        }

        console.warn(`Duplicate key found: ${key}.  Skipping...`);
      });
    }

    const initializeEnv = async (env: string) => {
      console.info(`Initializing Keypa for environment: ${env}`);
      const envConfig = builder.get(env);

      // Initialize the process.env provider
      let fn = getProviderFetch('process.env');
      let values = (await fn());
      hydrate(values);

      // Initialize the other providers
      for (const providerType of envConfig.providerTypes) {
        const config = envConfig.providers.get(providerType);
        hydrate(await getProviderFetch(providerType)(config));
      }

      instance._envCache = new KeypaValueCache(env, result);
    };

    await initializeEnv(environment);
    instance.log('table');

    return instance;
  }
}