import { KeypaValue } from "../index.js";
import { ProviderConfigType } from '../config.js';

/**
 * Initializes the 'process.env' configuration.
 */
export const fetch = async (config: ProviderConfigType<'process.env'> = {}): Promise<Record<string, KeypaValue>> => {
  const values: Record<string, KeypaValue> = {};

  Object.keys(process.env).forEach((key) => {
    values[key] = (new KeypaValue(key, process.env[key], 'process.env'));
  });

  return values;
}