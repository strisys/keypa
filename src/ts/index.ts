import { KeypaConfigBuilder, KeypaProviderConfig, ProviderType } from './config.js';
import { getLoader, ProviderLoader } from './providers/index.js';
import { KeypaValueCache, KeypaValue } from './value.js';

export { KeypaConfigBuilder, KeypaProviderConfig, KeypaValue };
export type { ProviderType };
export type ListenerFn = (result: ListenerResult) => void;

export type CloudProviderExecutionContext = ('aws' | 'azure' | 'gcp' | 'unknown');

const exists = (name: string): boolean => {
  return Boolean(process.env[name]);
}

const anyOneOf = (...names: Array<string>): boolean => {
  for (const name of names) {
    if (exists(name)) {
      return true;
    }
  }

  return false;
}

const isInAzure = (): boolean => {
  return (anyOneOf('WEBSITE_SITE_NAME', 'WEBSITE_SITE_NAME'));
}

const isInAws = (): boolean => {
  return (anyOneOf('AWS_EXECUTION_ENV', 'ECS_CONTAINER_METADATA_URI', 'EC2_INSTANCE_ID ', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_REGION', 'ELASTIC_BEANSTALK_ENVIRONMENT_NAME', 'ELASTIC_BEANSTALK_ENVIRONMENT_ID'));
}

const isInGcp = (): boolean => {
  return (anyOneOf('GCP_PROJECT', 'FUNCTION_NAME', 'FUNCTION_REGION', 'GAE_APPLICATION', 'GAE_ENV ', 'GAE_SERVICE', 'GAE_VERSION', 'GAE_INSTANCE', 'KUBERNETES_SERVICE_HOST', 'KUBERNETES_SERVICE_PORT', 'GCE_METADATA_HOST', 'GCE_METADATA_IP', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT'));
}

const cloudExecutionContext = (): CloudProviderExecutionContext => {
  if (isInAws()) {
    return 'aws';
  }

  if (isInAzure()) {
    return 'azure';
  }

  if (isInGcp()) {
    return 'gcp';
  }

  return 'unknown'
}


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

  public cloudExecutionContext(): CloudProviderExecutionContext {
    return cloudExecutionContext()
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
  private static _initPromise: (Promise<Keypa> | null) = null;
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

  public cloudExecutionContext(): CloudProviderExecutionContext {
    return cloudExecutionContext()
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

  private static hydrate(values: Record<string, KeypaValue>, results: Record<string, KeypaValue>, environment: string, valueListener?: ListenerFn): void {
    Object.keys(values).forEach((key) => {
      const value = values[key];

      if (!results[key]) {
        results[key] = value;

        if (valueListener) {
          valueListener(new ListenerResult(environment, value, results));
        }

        return;
      }

      results[key].addDuplicate(value);
    });

  }

  private static initializeSync(builder: KeypaConfigBuilder, environment: string, valueListener?: ListenerFn): [Record<string, KeypaValue>, Array<ProviderType>] {
    const result: Record<string, KeypaValue> = {};
    console.info(`Initializing Keypa for environment: ${environment}`);

    const envConfig = builder.get(environment);
    const processed: Array<ProviderType> = [];

    const processLoader = (providerType: ProviderType): ProviderLoader => {
      const loader = getLoader(providerType);
      processed.push(providerType);

      const config = envConfig.providers.get(providerType);
      const fn = loader.getFetchFn();
      const values = fn(config);
      Keypa.hydrate(values, result, environment, valueListener);

      return loader;
    }

    processLoader('process.env');

    // Initialize the other providers
    for (const providerType of envConfig.providerTypes) {
      const loader = getLoader(providerType);

      // break on the first that is not async
      if (loader.isAsync) {
        break
      }

      processLoader(providerType);
    }

    return [result, processed];
  }

  private static async initializeAsync(builder: KeypaConfigBuilder, environment: string, accumulator: Record<string, KeypaValue>, providerTypes: Array<ProviderType>): Promise<Keypa> {
    const instance = new Keypa(builder);
    const envConfig = builder.get(environment);

    // Initialize the other providers
    for (const providerType of envConfig.providerTypes.filter((pt) => !providerTypes.includes(pt))) {
      const config = envConfig.providers.get(providerType);
      const fn = getLoader(providerType).getFetchFn();
      const values = (await fn(config));
      Keypa.hydrate(values, accumulator, environment);
    }

    if (Keypa._instance) {
      return Keypa._instance;
    }

    instance._envCache = new KeypaValueCache(environment, accumulator);
    instance.log('table');

    return (Keypa._instance = instance);
  }

  public static async initialize(builder: KeypaConfigBuilder, environment: string, valueListener?: ListenerFn): Promise<Keypa> {
    if (Keypa._instance) {
      return Keypa._instance;
    }

    if (Keypa._initPromise) {
      return Keypa._initPromise;
    }

    const [accumulator, processed] = Keypa.initializeSync(builder, environment, valueListener);
    const promise = (await (Keypa._initPromise = Keypa.initializeAsync(builder, environment, accumulator, processed)));
    Keypa._initPromise = null;

    return promise;
  }
}