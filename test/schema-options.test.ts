import omit from 'lodash/omit';
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

  it('Sets `id: false` and `minimize: false` by default in schema options', () => {
    const defaultSchemaOptions: SchemaOptions = {
      id: false,
      minimize: false,
    };
    const zodSchema = z.object({}).mongoose();

    const Schema = toMongooseSchema(zodSchema);

    const schemaUserProvidedOptions = (Schema as any)._userProvidedOptions;
    expect(schemaUserProvidedOptions).toMatchObject(defaultSchemaOptions);
    expect(Object.keys(schemaUserProvidedOptions)).toHaveLength(
      Object.keys(defaultSchemaOptions).length,
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

  it('Does not set any sub schema options by default', () => {
    const zodSchema = z
      .object({
        friends: z.object({
          ids: z.number().int().array(),
        }),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(omit((Schema.paths.friends?.schema as any)._userProvidedOptions, 'typeKey')).toEqual({});
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
});
