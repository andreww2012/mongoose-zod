import M from 'mongoose';
import {z} from 'zod';
import {MongooseZodError, toMongooseSchema, zodMongooseCustomType} from '../src/index.js';

describe('Schema shape replication', () => {
  it('Creates a mongoose schema based on fields provided in a Zod schema', () => {
    const zodSchema = z
      .object({
        username: z.string(),
        registered: z.boolean(),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Object.keys(Schema.paths).sort()).toEqual(['_id', 'username', 'registered'].sort());
  });

  it('Does not allow the root schema not to be called with .mongoose()', () => {
    const zodSchema = z.object({username: z.string()});

    expect(() => {
      toMongooseSchema(zodSchema as any);
    }).toThrow(MongooseZodError);
  });

  it('Does not allow the root schema to be anything but an object', () => {
    const zodSchema = z.string();

    expect(() => {
      toMongooseSchema(zodSchema as any);
    }).toThrow(MongooseZodError);
  });

  it('Creates sub-schemas for fields with object type', () => {
    const zodSchema = z
      .object({
        username: z.string(),
        friends: z.object({
          ids: z.number().int().array(),
          count: z.number().int(),
        }),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.friends).toBeInstanceOf(M.SchemaTypes.Subdocument);
    expect(Object.keys((Schema as any).singleNestedPaths).sort()).toEqual(
      ['friends.ids', 'friends.count', 'friends.ids.$'].sort(),
    );
    expect(Object.keys(Schema.childSchemas[0]?.schema.paths || {}).sort()).toEqual(
      ['ids', 'count'].sort(),
    );
  });

  it('Assigns special `MongooseZodUniversalType` type for primitives or unions of primitives', () => {
    [
      z.string(),
      z.number(),
      z.boolean(),
      z.date(),
      z.literal(42),
      z.nan(),
      z.null(),
      z.union([z.string(), z.number(), z.boolean(), z.date(), z.literal(42), z.nan(), z.null()]),
      z.enum(['a', 'b', 'c']),
      z.nativeEnum({a: 1, b: 2, c: 3}),
      z.string().brand(),
    ].forEach((zodSchema) => {
      const Schema = toMongooseSchema(z.object({prop: zodSchema}).mongoose());
      expect(Schema.paths.prop).toBeInstanceOf(
        (M.Schema.Types as Record<string, unknown>).MongooseZodUniversalType,
      );
    });
  });

  it('Assigns Mixed type for complex types', () => {
    const typesProducingMixedType = [
      z.any(),
      z.unknown(),
      z.record(z.number()),
      z.tuple([z.string(), z.string(), z.boolean()]),
      z.union([z.string(), z.number().array()]),
      z.intersection(z.string(), z.number()),
      z.discriminatedUnion('type', [
        z.object({type: z.literal('a'), a: z.string()}),
        z.object({type: z.literal('b'), b: z.string()}),
      ]),
    ];

    typesProducingMixedType.forEach((zodSchema) => {
      const Schema = toMongooseSchema(z.object({prop: zodSchema}).mongoose());
      expect(Schema.paths.prop).toBeInstanceOf(M.Schema.Types.Mixed);
    });
  });

  it('Assigns Array type for fields of ZodArray type', () => {
    const zodSchema = z
      .object({
        friends: z.number().array(),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.friends).toBeInstanceOf(M.Schema.Types.Array);
    expect((Schema.paths.friends as any).$embeddedSchemaType).not.toBeInstanceOf(
      M.Schema.Types.Array,
    );
  });

  it('Correctly handles multidimensional arrays', () => {
    const zodSchema = z
      .object({
        friendsFriends: z.number().array().array(),
        matrices: z.number().array().array().array().optional(),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.friendsFriends).toBeInstanceOf(M.Schema.Types.Array);
    expect((Schema.paths.friendsFriends as any).$embeddedSchemaType).toBeInstanceOf(
      M.Schema.Types.Array,
    );
    expect(
      (Schema.paths.friendsFriends as any).$embeddedSchemaType.$embeddedSchemaType,
    ).not.toBeInstanceOf(M.Schema.Types.Array);
    expect((Schema.paths.matrices as any).$embeddedSchemaType.$embeddedSchemaType).toBeInstanceOf(
      M.Schema.Types.Array,
    );
  });

  it('Assigns Map type for fields of ZodMap type', () => {
    const zodSchema = z
      .object({
        dict: z.map(z.number(), z.object({a: z.number()})),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.dict).toBeInstanceOf(M.Schema.Types.Map);
  });

  it('Assigns custom built-in Buffer type when set with `zodMongooseCustomType()`', () => {
    const zodSchema = z
      .object({
        data: zodMongooseCustomType('Buffer'),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.data).toBeInstanceOf(M.Schema.Types.Buffer);
  });

  it('Assigns custom external Long type when set with `zodMongooseCustomType()`', () => {
    // eslint-disable-next-line global-require
    require('mongoose-long')(M);

    const zodSchema = z
      .object({
        data: zodMongooseCustomType('Long' as any),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.data).toBeInstanceOf((M.Schema.Types as Record<string, unknown>).Long);
  });

  it('Throws when unsupported zod type is used', () => {
    const unsupportedZodSchemas = [
      z.undefined(),
      z.void(),
      z.bigint(),
      z.never(),
      z.set(z.string()),
      z.promise(z.number()),
      z.function(),
      z.lazy(() => z.boolean()),
      z.preprocess(String, z.string()),
      z.string().transform((val) => val.length),
    ];

    unsupportedZodSchemas.forEach((zodSchema) => {
      expect(() => {
        toMongooseSchema(z.object({prop: zodSchema}).mongoose());
      }).toThrow(MongooseZodError);
    });
  });
});
