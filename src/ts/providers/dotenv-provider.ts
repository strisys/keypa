import { config } from 'dotenv';
import { initialize as initializeProcessEnv } from './process-env-provider.js';
import { KeypaValue } from '../index.js';
import { ProviderConfigType } from '../config.js';

/**
 * Initializes the 'dotenv' configuration.
 * @param config The configuration options.
 */
export const initialize = async <P extends 'dotenv'>(options: ProviderConfigType<P>): Promise<Record<string, KeypaValue>> => {
  const before = (await initializeProcessEnv());

  console.log(`loading dotenv configuration with options: ${JSON.stringify(options)}`)
  const result = (config(options).parsed || {});
  console.log(`dotenv loaded successfully! ${JSON.stringify(result)}`)

  const values: Record<string, KeypaValue> = {};

  Object.keys(result).forEach((key) => {
    if (!before[key]) {
      values[key] = (new KeypaValue(key, result[key], 'dotenv'));
    }
  });

  return values;
}