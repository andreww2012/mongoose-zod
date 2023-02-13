import {z} from 'zod';
import {addMongooseToZodPrototype, addMongooseTypeOptionsToZodPrototype} from './extensions.js';

addMongooseToZodPrototype(z);
addMongooseTypeOptionsToZodPrototype(z);

export {MongooseZodError} from './errors.js';
export {bufferMongooseGetter, genTimestampsSchema} from './mongoose-helpers.js';
export {toMongooseSchema} from './to-mongoose.js';
export type {
  DisableablePlugins,
  SetupOptions,
  ToMongooseSchemaOptions,
  UnknownKeysHandling,
} from './mz-types.js';
export {mongooseZodCustomType} from './zod-helpers.js';
export {
  MongooseSchemaOptionsSymbol,
  MongooseTypeOptionsSymbol,
  ZodMongoose,
  toZodMongooseSchema,
  addMongooseTypeOptions,
  z,
} from './extensions.js';
export {setup} from './setup.js';
