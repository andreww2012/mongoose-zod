import {z} from 'zod';
import {
  addMongooseToZodPrototype,
  addMongooseTypeOptionsToZodPrototype,
} from '../src/extensions.js';
import {setup, setupState} from '../src/setup.js';
import {toMongooseSchema} from '../src/to-mongoose.js';
import {getSchemaPlugins, importModule} from './shared.js';

describe('Setup', () => {
  beforeEach(() => {
    setupState.isSetUp = false;
    delete setupState.options;
    addMongooseToZodPrototype(null);
    addMongooseTypeOptionsToZodPrototype(null);
  });

  describe('Extending zod prototype', () => {
    it('Adds custom functions to zod prototype as normal if `z` option is not passed in setup', () => {
      setup();

      expect(typeof z.ZodObject.prototype.mongoose).toBe('function');
      expect(typeof z.ZodType.prototype.mongooseTypeOptions).toBe('function');
    });

    it('Does not pollute the zod prototype if asked not to', () => {
      setup({z: null});

      expect(z.ZodObject.prototype.mongoose).toBe(undefined);
      expect(z.ZodType.prototype.mongooseTypeOptions).toBe(undefined);
    });

    it('Does not extend zod prototype if the same keys are already in use', () => {
      setup();

      const SET_TO_ZOD_OBJECT_MONGOOSE = 'anything' as any;
      const SET_TO_ZOD_TYPE_MONGOOSE_TYPE_OPTIONS = null as any;

      z.ZodObject.prototype.mongoose = SET_TO_ZOD_OBJECT_MONGOOSE;
      z.ZodType.prototype.mongooseTypeOptions = SET_TO_ZOD_TYPE_MONGOOSE_TYPE_OPTIONS;

      expect(z.ZodObject.prototype.mongoose).toBe(SET_TO_ZOD_OBJECT_MONGOOSE);
      expect(z.ZodType.prototype.mongooseTypeOptions).toBe(SET_TO_ZOD_TYPE_MONGOOSE_TYPE_OPTIONS);
    });

    it('Allows to pass a custom `z`', () => {
      const customZ = {ZodObject: {prototype: {}}, ZodType: {prototype: {}}} as typeof z;
      setup({z: customZ});

      expect(z.ZodObject.prototype.mongoose).toBe(undefined);
      expect(z.ZodType.prototype.mongooseTypeOptions).toBe(undefined);
      expect(typeof customZ.ZodObject.prototype.mongoose).toBe('function');
      expect(typeof customZ.ZodType.prototype.mongooseTypeOptions).toBe('function');
    });

    it('Subsequent setup calls do nothing (trying to unset `z`)', () => {
      setup();
      setup({z: null});

      expect(typeof z.ZodObject.prototype.mongoose).toBe('function');
      expect(typeof z.ZodType.prototype.mongooseTypeOptions).toBe('function');
    });

    it('Subsequent setup calls do nothing (trying to call as normal)', () => {
      setup({z: null});
      setup();

      expect(z.ZodObject.prototype.mongoose).toBe(undefined);
      expect(z.ZodType.prototype.mongooseTypeOptions).toBe(undefined);
    });
  });

  describe('Default To Mongoose Schema options', () => {
    it('Allows to set default options (unknown keys)', () => {
      setup({defaultToMongooseSchemaOptions: {unknownKeys: 'strip-unless-overridden'}});

      const Schema = toMongooseSchema(z.object({a: z.string()}).mongoose());
      expect((Schema as any)._userProvidedOptions).toMatchObject({
        strict: true,
      });
    });

    it('Allows to set default options (disable all plugins)', () => {
      setup({defaultToMongooseSchemaOptions: {disablePlugins: true}});

      const Schema = toMongooseSchema(z.object({a: z.string()}).mongoose());

      const schemaPlugins = getSchemaPlugins(Schema);

      expect(schemaPlugins).not.toContain(importModule('mongoose-lean-virtuals'));
      expect(schemaPlugins).not.toContain(importModule('mongoose-lean-defaults'));
      expect(schemaPlugins).not.toContain(importModule('mongoose-lean-getters'));
    });

    it('Allows to overwrite default options (unknown keys)', () => {
      setup({defaultToMongooseSchemaOptions: {unknownKeys: 'strip-unless-overridden'}});

      const Schema = toMongooseSchema(z.object({a: z.string()}).mongoose(), {
        unknownKeys: 'throw',
      });
      expect((Schema as any)._userProvidedOptions).toMatchObject({
        strict: 'throw',
      });
    });

    it('Allows to overwrite default options (smart disable plugins)', () => {
      setup({defaultToMongooseSchemaOptions: {disablePlugins: true}});

      const Schema = toMongooseSchema(z.object({a: z.string()}).mongoose(), {
        disablePlugins: {
          leanVirtuals: false,
        },
      });

      const schemaPlugins = getSchemaPlugins(Schema);

      expect(schemaPlugins).toContain(importModule('mongoose-lean-virtuals'));
      expect(schemaPlugins).not.toContain(importModule('mongoose-lean-defaults'));
      expect(schemaPlugins).not.toContain(importModule('mongoose-lean-getters'));
    });
  });
});
