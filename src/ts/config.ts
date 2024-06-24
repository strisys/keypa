import { TokenCredential } from '@azure/identity';
import { DotenvConfigOptions } from 'dotenv';
import { Keypa } from './index.js';

export type ProviderType = ('process.env' | 'dotenv' | 'azure-keyvault' | 'aws-secrets-manager');

export type ProviderConfigType<P extends ProviderType> =
  P extends 'process.env' ? {} :
  P extends 'dotenv' ? (DotenvConfigOptions | undefined) :
  P extends 'azure-keyvault' ? { keyVaultName: string, tokenCredentials?: (TokenCredential | Array<TokenCredential>) } :
  P extends 'aws-secrets-manager' ? { profile: string, secrets: (string | Array<string>) } :
never;


class KeypaProviderConfigCollection {
  private readonly _inner: Map<ProviderType, any> = new Map<ProviderType, any>();
  private readonly _providerTypes: Array<ProviderType> = [];
  private readonly _parent: KeypaProviderConfig;

  public constructor(config: KeypaProviderConfig) {
    this._parent = config;
  }

  public set<T extends ProviderType>(type: T, config: ProviderConfigType<T>): KeypaProviderConfigCollection {
    if (this.config.isReadOnly) {
      return this
    }

    this._inner.set(type, config);
    this._providerTypes.push(type);
    return this;
  }

  public get providerTypes(): Array<ProviderType> {
    return [...this._providerTypes];
  }

  public get config(): KeypaProviderConfig {
    return this._parent;
  }

  public get<T extends ProviderType>(provider: T): ProviderConfigType<T> {
    return (this._inner.get(provider) as ProviderConfigType<T>);
  }

  public *[Symbol.iterator]() {
    for (const type of this._providerTypes) {
      yield this.get(type);
    }
  }

  public forEach(callback: (value: any, key: ProviderType, map: Map<ProviderType, any>) => void, thisArg?: any): void {
    this._providerTypes.forEach((type) => {
      callback(this.get(type), type, this._inner);
    }, thisArg);
  }
}

export class KeypaProviderConfig {
  private readonly _providerConfigs: KeypaProviderConfigCollection;
  private readonly _parent: KeypaConfigBuilder;
  private readonly _environment: string;

  public constructor(builder: KeypaConfigBuilder, environment: string) {
    this._environment = environment;
    this._providerConfigs = new KeypaProviderConfigCollection(this);
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

  public get providers(): KeypaProviderConfigCollection {
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

  public async initialize(environment: string): Promise<Keypa> {
    return Keypa.initialize(this, environment);
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
