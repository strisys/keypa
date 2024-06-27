import { TokenCredential } from '@azure/identity';
import { DotenvConfigOptions } from 'dotenv';
import { Keypa, ListenerFn, ExecutionContext, ExecutionContextType } from './index.js';

export type ProviderType = ('process.env' | 'dotenv' | 'azure-keyvault' | 'aws-secrets-manager');

export type ProviderConfigType<P extends ProviderType> =
  P extends 'process.env' ? {} :
  P extends 'dotenv' ? (DotenvConfigOptions | undefined) :
  P extends 'azure-keyvault' ? { keyVaultName: string, tokenCredentials?: (TokenCredential | Array<TokenCredential>) } :
  P extends 'aws-secrets-manager' ? { profile: string, secrets: (string | Array<string>) } :
  P extends 'null' ? {} :
  never;

export class KeypaProviderTypeItem {
  private readonly _provider: ProviderType;
  private readonly _isInitializable: (((config: KeypaProviderTypeItem) => boolean) | null) = null;
  private readonly _config: any;

  public constructor(provider: ProviderType, config: any, isInitializable?: (((item: KeypaProviderTypeItem) => boolean) | null)) {
    this._provider = provider;
    this._config = config;
    this._isInitializable = (isInitializable || null);
  }

  public get isInitializable(): boolean {
    return ((typeof this._isInitializable === 'function') ? this._isInitializable(this) : true);
  }

  public get provider(): ProviderType {
    return this._provider;
  }

  public get config(): any {
    return this._config;
  }

  public get executionContext(): ExecutionContextType {
    return ExecutionContext.value
  }

  public executionContextIsOneOf(...contexts: Array<ExecutionContextType>): boolean {
    return (contexts || []).some((context) => (context === this.executionContext), this);
  }
}

class KeypaProviderTypeItemCollection {
  private readonly _items: Array<KeypaProviderTypeItem> = [];
  private readonly _parent: KeypaProviderConfig;

  public constructor(config: KeypaProviderConfig) {
    this._parent = config;
  }

  public set<T extends ProviderType>(type: T, config: ProviderConfigType<T>, initializable?: (item: KeypaProviderTypeItem) => boolean): KeypaProviderTypeItemCollection {
    if (this.config.isReadOnly) {
      return this
    }

    this._items.push(new KeypaProviderTypeItem(type, config, initializable));

    return this;
  }

  public get providerTypes(): Array<ProviderType> {
    return this._items.map((item) => item.provider);
  }

  public get config(): KeypaProviderConfig {
    return this._parent;
  }

  public get<T extends ProviderType>(provider: T): ProviderConfigType<T> {
    return (this._items.find((item) => (item.provider === provider))?.config || {});
  }

  public *[Symbol.iterator]() {
    for (const type of this.providerTypes) {
      yield this.get(type);
    }
  }

  public forEach(callback: (value: any, key: ProviderType, array: Array<KeypaProviderTypeItem>) => void, thisArg?: any): void {
    this.providerTypes.forEach((type) => {
      callback(this.get(type), type, this._items);
    }, thisArg);
  }
}

export class KeypaProviderConfig {
  private readonly _providerConfigs: KeypaProviderTypeItemCollection;
  private readonly _parent: KeypaConfigBuilder;
  private readonly _environment: string;

  public constructor(builder: KeypaConfigBuilder, environment: string) {
    this._environment = environment;
    this._providerConfigs = new KeypaProviderTypeItemCollection(this);
    this._parent = builder;
  }

  public get environment(): string {
    return this._environment;
  }

  public get isReadOnly(): boolean {
    return this._parent.isReadOnly;
  }

  public get providerTypes(): Array<ProviderType> {
    return this._providerConfigs.providerTypes;
  }

  public get providers(): KeypaProviderTypeItemCollection {
    return this._providerConfigs;
  }
}

export class KeypaConfigBuilder {
  private readonly _configs: Array<KeypaProviderConfig>;
  private _isReadOnly: boolean = false;

  private constructor(environments: string[]) {
    this._configs = environments.map((env) => new KeypaProviderConfig(this, env));
  }

  public static standard(): KeypaConfigBuilder {
    return KeypaConfigBuilder.configure('development', 'staging', 'production');
  }

  public static configure(...environments: Array<string>): KeypaConfigBuilder {
    const useStandard = ((!environments) || (environments.length === 0));
    return ((useStandard) ? KeypaConfigBuilder.standard() : new KeypaConfigBuilder(environments));
  }

  public async initialize(environment: string, valueListener?: ListenerFn): Promise<Keypa> {
    return Keypa.initialize(this, environment, valueListener);
  }

  public get isReadOnly(): boolean {
    return this._isReadOnly;
  }

  public setAsReadonly(): KeypaConfigBuilder {
    this._isReadOnly = true;
    return this;
  }

  public get environments(): Array<string> {
    return this._configs.map((config) => config.environment);
  }

  public get(environment: string): KeypaProviderConfig {
    const config = this._configs.find((c) => (c.environment === environment));

    if (!config) {
      throw new Error(`No Keypa configuration found for environment '${environment}'`);
    }

    return config;
  }
}
