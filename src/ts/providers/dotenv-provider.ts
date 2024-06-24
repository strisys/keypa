import { config } from 'dotenv';
import { KeypaValue } from '../index.js';
import { ProviderConfigType } from '../config.js';

type DotEnvProviderConfigType = ProviderConfigType<'dotenv'>;

export const fetch = async (options: DotEnvProviderConfigType): Promise<Record<string, KeypaValue>> => {
  console.log(`loading dotenv configuration with options: ${JSON.stringify(options)}`)
  const result = (config(options).parsed || {});

  if (result.error) {
    const message = `failed to load environment file from '${options?.path}' ${result.error}`;
    console.error(message);
    throw new Error(message);
  }

  console.log(`dotenv loaded successfully! ${JSON.stringify(result)}`)

  const source = ((options?.path) ? `dotenv (${options.path})` : 'dotenv');
  const values: Record<string, KeypaValue> = {};

  Object.keys(result).forEach((key) => {
    values[key] = (new KeypaValue(key, result[key], source, false));
  });

  return values;
}