import {z as originalZ} from 'zod';
import {addMongooseToZodPrototype, addMongooseTypeOptionsToZodPrototype} from './extensions.js';
import type {SetupOptions} from './mz-types.js';

export const setupState: {
  isSetUp: boolean;
  options?: SetupOptions;
} = {isSetUp: false};

export const setup = (options: SetupOptions = {}) => {
  if (setupState.isSetUp) {
    return;
  }
  setupState.isSetUp = true;
  setupState.options = options;

  addMongooseToZodPrototype(null);
  addMongooseTypeOptionsToZodPrototype(null);
  if (options.z !== null) {
    addMongooseToZodPrototype(options.z || originalZ);
    addMongooseTypeOptionsToZodPrototype(options.z || originalZ);
  }
};
