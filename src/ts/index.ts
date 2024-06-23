import { KeypaConfigBuilder, KeypaProviderConfig, ProviderType } from './config.js';
import { getInitializer } from './providers/index.js';


export { KeypaConfigBuilder, KeypaProviderConfig };
export type { ProviderType };

export class KeypaValue {
  private readonly _name: string;
  private readonly _value: any;
  private readonly _source: string;
  private readonly _isSecret: boolean;

  public constructor(name: string, value: any, source: string, isSecret: boolean = false) {
    this._name = name;
    this._value = value;
    this._source = source;
    this._isSecret = isSecret;
  }

  public get name(): string {
    return this._name;
  }

  public get value(): any {
    return this._value;
  }

  public get source(): string {
    return this._source;
  }

  public get isSecret(): boolean {
    return this._isSecret;
  }

  public toJson(): {} {
    let value = `${this._value}`;

    if ((!this._isSecret) && (value.length >= 45)) {
      value = `${value.substring(0, 42)}...`;
    }

    if (this._isSecret) {
      value = '*'.repeat(value.length);;
    }

    return { name: this._name, source: this._source, isSecret: this._isSecret, value };
  }

  public toString(): string {
    return `name:=${this._name},value:=${this._value},source:=${this._source}`;
  }
}

class KeypaValueCache {
  private readonly _inner: Record<string, KeypaValue> = {};
  private readonly _environment: string;

  public constructor(environment: string, values: Record<string, KeypaValue>) {
    this._environment = environment;
    this._inner = { ...values };
  }

  public get environment(): string {
    return this._environment;
  }

  public tryGet(name: string): KeypaValue {
    return this._inner[name];
  }

  public get(name: string): KeypaValue {
    const value = this.tryGet(name);

    if (!value) {
      throw new Error(`Failed to get a KeyNameValue for the specified name '${name}'.  It is not initialized for the environment '${this.environment}'.`);
    }

    return value
  }

  public toJson(): Array<{}> {
    return Object.values(this._inner).map((v) => {
      return { environment: this.environment, ...v.toJson() };
    });
  }
}

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
      let fn = getInitializer('process.env');
      let values = (await fn());
      hydrate(values);

      // Initialize the other providers
      for (const providerType of envConfig.providerTypes) {
        const config = envConfig.providers.get(providerType);
        hydrate(await getInitializer(providerType)(config));
      }

      instance._envCache = new KeypaValueCache(env, result);
    };

    await initializeEnv(environment);
    instance.log('table');

    return instance;
  }
}