
const MAX_VALUE_LENGTH = 30;

export class KeypaValue {
  private readonly _name: string;
  private readonly _value: any;
  private readonly _source: string;
  private readonly _isSecret: boolean;
  private readonly _duplicates: Array<KeypaValue> = [];

  public constructor(name: string, value: any, source: string, isSecret: boolean) {
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

  public addDuplicate(value: KeypaValue): KeypaValue {
    if ((value) && (value !== this) && (this.name === value.name)) {
      this._duplicates.push(value);
      console.warn(`Duplicate found: ${value.toString()}.`);
    }

    return this;
  }

  public get duplicates(): Array<KeypaValue> {
    return [...this._duplicates];
  }

  public get hasDuplicates(): boolean {
    return (this._duplicates.length > 0);
  }

  private tryGetMaskedValue(): string {
    let value = `${this._value}`;
    const isLongValue = (value.length >= MAX_VALUE_LENGTH);

    if ((!this._isSecret) && (isLongValue)) {
      value = `${value.substring(0, (MAX_VALUE_LENGTH - 3))}...`;
    }

    if (this._isSecret) {
      value = '*'.repeat(((isLongValue) ? (MAX_VALUE_LENGTH - 3) : value.length));
    }

    return value;
  }

  public toJson(): {} {
    return { name: this._name, source: this._source, isSecret: this._isSecret, duplicates: this._duplicates.length, value: this.tryGetMaskedValue() };
  }

  public toString(): string {
    return `name:=${this._name},source:=${this._source},value:=${this.tryGetMaskedValue()},isSecret:=${this._isSecret},duplicates:=${this._duplicates.length}`;
  }
}

export class KeypaValueCache {
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