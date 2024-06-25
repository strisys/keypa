import { KeypaConfigBuilder, KeypaProviderConfig, ProviderType } from './config.js';
import { getProviderFetch } from './providers/index.js';
import { KeypaValueCache, KeypaValue } from './value.js';

export { KeypaConfigBuilder, KeypaProviderConfig, KeypaValue };
export type { ProviderType };
export type ListenerFn = (result: ListenerResult) => void;

export class ListenerResult {
  private readonly _value: KeypaValue;
  private readonly _accumulator: Record<string, KeypaValue>;
  private readonly _environment: string;

  public constructor(envrionment: string, value: KeypaValue, accumulator: Record<string, KeypaValue>) {
    this._environment = envrionment;
    this._value = value;
    this._accumulator = accumulator;
  }

  public get environment(): string {
    return this._environment;
  }

  public get current(): KeypaValue {
    return this._value;
  }

  public tryGet(name: string): KeypaValue {
    return this._accumulator[name];
  }

  public get(name: string): KeypaValue {
    const value = this.tryGet(name);

    if (!value) {
      throw new Error(`Failed to get value for name: ${name}`);
    }

    return value;
  }

  public has(name: string): boolean {
    return Boolean(this._accumulator[name]);
  }

  public hasAll(...names: Array<string>): boolean {
    for (const name of (names || [])) {
      if (!this.has(name)) {
        return false;
      }
    }

    return true;
  }

  public hasAny(...names: Array<string>): boolean {
    return (names || []).some(this.has, this);
  }
}

export class Keypa {
  private static _initialiatzationPromise: (Promise<Keypa> | null) = null;
  private static _instance: (Keypa | null) = null;
  private readonly _builder: KeypaConfigBuilder;
  private _envCache: KeypaValueCache = new KeypaValueCache('unknown', {});

  private constructor(builder: KeypaConfigBuilder) {
    this._builder = builder;
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

  public getMany(...keys: Array<string>): Record<string, KeypaValue> {
    return keys.reduce<Record<string, KeypaValue>>((acc, key) => {
      acc[key] = this.get(key);
      return acc;
    }, {});
  }

  public tryGetMany(...keys: Array<string>): Record<string, KeypaValue> {
    return keys.reduce<Record<string, KeypaValue>>((acc, key) => {
      const value = this.tryGet(key);

      if (value !== undefined) {
        acc[key] = value;
      }

      return acc;
    }, {});
  }

  public toJson(): Array<{}> {
    return this._envCache.toJson();
  }

  public static get current(): Keypa {
    if (!Keypa._instance) {
      throw new Error('failed to get current Keypa instance.  initialize has not been invoked or completed successfully or it has been disposed.');
    }

    return Keypa._instance;
  }

  public static reinitialize(): Keypa {
    if (!Keypa._instance) {
      throw new Error('Failed to reinitialize.  Keypa is was never initialized.');
    }

    const builder = Keypa._instance._builder;
    const environment = Keypa._instance.environment;

    Keypa.dispose();
    Keypa.initialize(builder, environment);

    return Keypa._instance;
  }

  public static get isInitialized(): boolean {
    return (Keypa._instance !== null);
  }

  public static dispose(): void {
    Keypa._instance = null;
  }

  private static async _initialize(builder: KeypaConfigBuilder, environment: string, valueListener?: ListenerFn): Promise<Keypa> {
    if (Keypa._instance) {
      return Keypa._instance;
    }

    const instance = new Keypa(builder);
    const result: Record<string, KeypaValue> = {};

    console.info(`Initializing Keypa for environment: ${environment}`);

    const hydrate = (values: Record<string, KeypaValue>) => {
      Object.keys(values).forEach((key) => {
        const value = values[key];

        if (!result[key]) {
          result[key] = value;

          if (valueListener) {
            valueListener(new ListenerResult(environment, value, result));
          }

          return;
        }

        result[key].addDuplicate(value);
      });
    }

    const envConfig = builder.get(environment);

    // Initialize the process.env provider
    let fn = getProviderFetch('process.env');
    let values = (await fn());
    hydrate(values);

    // Initialize the other providers
    for (const providerType of envConfig.providerTypes) {
      const config = envConfig.providers.get(providerType);
      hydrate(await getProviderFetch(providerType)(config));
    }

    if (Keypa._instance) {
      return Keypa._instance;
    }

    instance._envCache = new KeypaValueCache(environment, result);
    instance.log('table');

    return (Keypa._instance = instance);
  }

  public static async initialize(builder: KeypaConfigBuilder, environment: string, valueListener?: ListenerFn): Promise<Keypa> {
    const promise = (Keypa._initialiatzationPromise || (Keypa._initialiatzationPromise = Keypa._initialize(builder, environment, valueListener)));
    Keypa._initialiatzationPromise = null;
    return promise;
  }
}