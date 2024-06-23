import { KeypaValue } from "../index.js";
import { ProviderConfigType } from '../config.js';

type ProcessEnvProviderConfigType = ProviderConfigType<'process.env'>;

export const fetch = async (config: ProcessEnvProviderConfigType = {}): Promise<Record<string, KeypaValue>> => {
  const values: Record<string, KeypaValue> = {};

  Object.keys(process.env).forEach((key) => {
    values[key] = (new KeypaValue(key, process.env[key], 'process.env', false));
  });

  return values;
}