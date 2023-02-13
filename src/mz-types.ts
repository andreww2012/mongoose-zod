import type {z} from 'zod';

export type UnknownKeysHandling = 'throw' | 'strip' | 'strip-unless-overridden';

export interface DisableablePlugins {
  leanVirtuals?: boolean;
  leanDefaults?: boolean;
  leanGetters?: boolean;
}

export interface ToMongooseSchemaOptions {
  disablePlugins?: DisableablePlugins | true;
  unknownKeys?: UnknownKeysHandling;
}

export interface SetupOptions {
  z?: typeof z | null;
  defaultToMongooseSchemaOptions?: ToMongooseSchemaOptions;
}
