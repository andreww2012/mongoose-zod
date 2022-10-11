import M from 'mongoose';
import {z} from 'zod';
import {MongooseZodError, mongooseZodCustomType, toMongooseSchema} from '../src/index.js';

enum TestStringEnum {
  a = 'A',
  b = 'B',
}

enum TestNumericEnum {
  a = 1,
  b = 2,
}

enum TestMixedEnum {
  a = 'A',
  b = 2,
}

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

  it.each([
    {zodType: 'number', schema: z.number(), type: 'Number'},
    {zodType: 'string', schema: z.string(), type: 'String'},
    {zodType: 'date', schema: z.date(), type: 'Date'},
    {zodType: 'boolean', schema: z.boolean(), type: 'Boolean'},
    {zodType: 'string literal', schema: z.literal('hi'), type: 'String'},
    {zodType: 'number literal', schema: z.literal(42), type: 'Number'},
    {zodType: 'boolean literal', schema: z.literal(false), type: 'Boolean'},
    {zodType: 'zod enum', schema: z.enum(['a', 'b', 'c']), type: 'String'},
    {zodType: 'string native enum', schema: z.nativeEnum(TestStringEnum), type: 'String'},
    {zodType: 'numeric native enum', schema: z.nativeEnum(TestNumericEnum), type: 'Number'},
    {zodType: 'branded string', schema: z.string().brand(), type: 'String'},
    {
      zodType: 'union of numbers',
      schema: z.union([z.number().min(5), z.number().max(1)]),
      type: 'Number',
    },
    {
      zodType: 'union of strings',
      schema: z.union([z.string().min(5), z.string().max(1)]),
      type: 'String',
    },
    {
      zodType: 'union of dates',
      schema: z.union([z.date().min(new Date(5)), z.date().min(new Date(1))]),
      type: 'Date',
    },
    {
      zodType: 'union of booleans',
      schema: z.union([z.boolean(), z.boolean()]),
      type: 'Boolean',
    },
  ])('Assigns `MongooseZod$type` mongoose type if zod type is $zodType', ({schema, type}) => {
    const Schema = toMongooseSchema(z.object({prop: schema}).mongoose());
    expect(Schema.paths.prop).toBeInstanceOf(
      (M.Schema.Types as Record<string, unknown>)[`MongooseZod${type}`],
    );
  });

  it('Assigns Mixed type for complex types', () => {
    const typesProducingMixedType = [
      z.nativeEnum(TestMixedEnum),
      z.nan(),
      z.literal(Number.NaN),
      z.null(),
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

  it('Assigns custom built-in Buffer type when set with `mongooseZodCustomType()`', () => {
    const zodSchema = z
      .object({
        data: mongooseZodCustomType('Buffer'),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.data).toBeInstanceOf(M.Schema.Types.Buffer);
  });

  it('Assigns custom external Long type when set with `mongooseZodCustomType()`', () => {
    // eslint-disable-next-line global-require
    require('mongoose-long')(M);

    const zodSchema = z
      .object({
        data: mongooseZodCustomType('Long' as any),
      })
      .mongoose();

    const Schema = toMongooseSchema(zodSchema);

    expect(Schema.paths.data).toBeInstanceOf((M.Schema.Types as Record<string, unknown>).Long);
  });

  it('Throws when unsupported zod type is used', () => {
    const unsupportedZodSchemas = [
      z.enum([] as any),
      z.enum([1, '2'] as any),
      z.nativeEnum({a: true, b: 2} as any),
      z.literal(Number.POSITIVE_INFINITY),
      z.literal(Number.NEGATIVE_INFINITY),
      z.literal(undefined),
      z.literal(1n),
      z.literal(Symbol.for('') as any),
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
