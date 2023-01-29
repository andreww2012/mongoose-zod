import type {SchemaOptions} from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';

describe('Schema options', () => {
  it('Generates mongoose schema with provided schema options', () => {
    const schemaOptions: SchemaOptions = {
      collection: 'test-collection',
      autoCreate: true,
      bufferCommands: false,
      capped: true,
    };
    const zodSchema = z.object({}).mongoose({schemaOptions: {...schemaOptions}});

    const Schema = toMongooseSchema(zodSchema);

    expect((Schema as any)._userProvidedOptions).toMatchObject(schemaOptions);
  });

  it('Sets `id: false`, `minimize: false`, `strict: throw` and a custom `lean` query method implementation in schema options by default', () => {
    const defaultSchemaOptions: SchemaOptions = {
      id: false,
      minimize: false,
      strict: 'throw',
    };
    const zodSchema = z.object({}).mongoose();

    const Schema = toMongooseSchema(zodSchema);

    const schemaUserProvidedOptions = (Schema as any)._userProvidedOptions;
    expect(schemaUserProvidedOptions).toMatchObject(defaultSchemaOptions);
    expect(schemaUserProvidedOptions.query?.lean).not.toBeUndefined();
    expect(Object.keys(schemaUserProvidedOptions)).toHaveLength(
      Object.keys(defaultSchemaOptions).length + 1,
    );
  });

  it('Takes into account custom `typeKey` set in schema options', () => {
    const CUSTOM_TYPE_KEY = '__type__';
    const CUSTOM_TYPE_KEY_NESTED = '$type';

    const schemaOptions: SchemaOptions<any> = {
      typeKey: CUSTOM_TYPE_KEY,
    };
    const zodSchema = z
      .object({
        a: z.string(),
        b: z
          .object({
            c: z.date(),
          })
          .mongoose({schemaOptions: {typeKey: CUSTOM_TYPE_KEY_NESTED}}),
      })
      .mongoose({schemaOptions: {...schemaOptions}});

    const Schema = toMongooseSchema(zodSchema);
    expect((Schema as any).options.typeKey).toEqual(CUSTOM_TYPE_KEY);
    expect((Schema.paths.b?.schema as any).options.typeKey).toEqual(CUSTOM_TYPE_KEY_NESTED);
  });

  it('Allows to override pre-set schema options and respects them', () => {
    const schemaOptions: SchemaOptions = {
      id: true,
      minimize: true,
      collection: 'test-collection',
    };
    const zodSchema = z.object({}).mongoose({
      schemaOptions: {...schemaOptions},
    });

    const Schema = toMongooseSchema(zodSchema);

    expect((Schema as any)._userProvidedOptions).toMatchObject(schemaOptions);
  });

  it('Respects sub schema options', () => {
    const subSchemaOptions: SchemaOptions = {id: false};
    const zodSchema = z
      .object({
        friends: z
          .object({
            ids: z.number().int().array(),
          })
          .mongoose({
            schemaOptions: {...subSchemaOptions},
          }),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect((Schema.paths.friends?.schema as any)._userProvidedOptions).toMatchObject(
      subSchemaOptions,
    );
  });

  describe('Schema strict mode', () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getOneLevelSchema = (schemaOptions?: SchemaOptions) =>
      z.object({}).mongoose({schemaOptions});
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getSchemaWithSubSchema = (schemaOptions?: SchemaOptions) =>
      z.object({b: z.object({c: z.date()}).mongoose({schemaOptions})}).mongoose();
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getSchemaWithArraySubSchema = (schemaOptions?: SchemaOptions) =>
      z.object({b: z.object({c: z.date()}).mongoose({schemaOptions}).array()}).mongoose();

    describe('`unknownKeys` option is not passed', () => {
      it('Sets `strict: throw` on a root schema when `unknownKeys` is not passed', () => {
        const Schema = toMongooseSchema(getOneLevelSchema());
        expect((Schema as any)._userProvidedOptions).toMatchObject({strict: 'throw'});
      });

      it('Sets `strict: throw` on a sub schema when `unknownKeys` is not passed', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema());
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it('Sets `strict: throw` on a sub schema for array when `unknownKeys` is not passed', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema());
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it('Allows to override `strict` option on a root schema', () => {
        const Schema = toMongooseSchema(getOneLevelSchema({strict: true}));
        expect((Schema as any)._userProvidedOptions).toMatchObject({strict: true});
      });

      it('Allows to override `strict` option on a sub schema', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema({strict: true}));
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
        expect((Schema as any)._userProvidedOptions).toMatchObject({strict: 'throw'});
      });

      it('Allows to override `strict` option on a sub schema for array', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema({strict: true}));
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
        expect((Schema as any)._userProvidedOptions).toMatchObject({strict: 'throw'});
      });
    });

    describe('`unknownKeys` option is set to `throw`', () => {
      it('Sets `strict: throw` on a root schema when `unknownKeys` is set to `throw`', () => {
        const Schema = toMongooseSchema(getOneLevelSchema(), {unknownKeys: 'throw'});
        expect((Schema as any)._userProvidedOptions).toMatchObject({strict: 'throw'});
      });

      it('Sets `strict: throw` on a sub schema when `unknownKeys` is set to `throw`', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema(), {unknownKeys: 'throw'});
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it('Sets `strict: throw` on a sub schema for array when `unknownKeys` is set to `throw`', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema(), {unknownKeys: 'throw'});
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });
    });

    describe('`unknownKeys` option is set to `strip`', () => {
      it('Sets `strict: true` on a root schema when `unknownKeys` is set to `strip`', () => {
        const Schema = toMongooseSchema(getOneLevelSchema(), {unknownKeys: 'strip'});
        expect((Schema as any)._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });

      it('Sets `strict: true` on a sub schema when `unknownKeys` is set to `strip`', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema(), {unknownKeys: 'strip'});
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });

      it('Sets `strict: true` on a sub schema for array when `unknownKeys` is set to `strip`', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema(), {unknownKeys: 'strip'});
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });
    });

    describe('`unknownKeys` option is set to `strip-unless-overridden`', () => {
      it('Sets `strict: true` on a root schema when `unknownKeys` is set to `strip-unless-overridden`', () => {
        const Schema = toMongooseSchema(getOneLevelSchema(), {
          unknownKeys: 'strip-unless-overridden',
        });
        expect((Schema as any)._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });

      it('Sets `strict: true` on a sub schema when `unknownKeys` is set to `strip-unless-overridden`', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema(), {
          unknownKeys: 'strip-unless-overridden',
        });
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });

      it('Sets `strict: true` on a sub schema for array when `unknownKeys` is set to `strip-unless-overridden`', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema(), {
          unknownKeys: 'strip-unless-overridden',
        });
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });
    });

    describe('`unknownKeys` option is set to `strip-unless-overridden-or-root`', () => {
      it('Sets `strict: throw` on a root schema when `unknownKeys` is set to `strip-unless-overridden-or-root`', () => {
        const Schema = toMongooseSchema(getOneLevelSchema(), {
          unknownKeys: 'strip-unless-overridden-or-root',
        });
        expect((Schema as any)._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it('Sets `strict: true` on a sub schema when `unknownKeys` is set to `strip-unless-overridden-or-root`', () => {
        const Schema = toMongooseSchema(getSchemaWithSubSchema(), {
          unknownKeys: 'strip-unless-overridden-or-root',
        });
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });

      it('Sets `strict: true` on a sub schema for array when `unknownKeys` is set to `strip-unless-overridden-or-root`', () => {
        const Schema = toMongooseSchema(getSchemaWithArraySubSchema(), {
          unknownKeys: 'strip-unless-overridden-or-root',
        });
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: true,
        });
      });
    });

    describe("Integration with zod's .passthrough() and .strict() methods", () => {
      it("Sets `strict: throw` on a sub schema when `unknownKeys` is not passed and zod's `.passthrough()` is used", () => {
        const Schema = toMongooseSchema(
          z.object({b: z.object({c: z.date()}).passthrough()}).mongoose(),
        );
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it("Sets `strict: false` on a sub schema when `unknownKeys` is set to `strip-unless-overridden` and zod's `.passthrough()` is used", () => {
        const Schema = toMongooseSchema(
          z.object({b: z.object({c: z.date()}).passthrough()}).mongoose(),
          {unknownKeys: 'strip-unless-overridden'},
        );
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: false,
        });
      });

      it("Sets `strict: false` on a sub schema when `unknownKeys` is set to `strip-unless-overridden-or-root` and zod's `.passthrough()` is used", () => {
        const Schema = toMongooseSchema(
          z.object({b: z.object({c: z.date()}).passthrough()}).mongoose(),
          {unknownKeys: 'strip-unless-overridden-or-root'},
        );
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: false,
        });
      });

      it("Sets `strict: throw` on a sub schema when `unknownKeys` is set to `strip-unless-overridden` and zod's `.strict()` is used", () => {
        const Schema = toMongooseSchema(
          z.object({b: z.object({c: z.date()}).strict()}).mongoose(),
          {unknownKeys: 'strip-unless-overridden'},
        );
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });

      it("Sets `strict: throw` on a sub schema when `unknownKeys` is set to `strip-unless-overridden-or-root` and zod's `.strict()` is used", () => {
        const Schema = toMongooseSchema(
          z.object({b: z.object({c: z.date()}).strict()}).mongoose(),
          {unknownKeys: 'strip-unless-overridden-or-root'},
        );
        expect((Schema as any).paths.b.schema._userProvidedOptions).toMatchObject({
          strict: 'throw',
        });
      });
    });
  });
});
