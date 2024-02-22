import M from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';

describe('Validation', () => {
  beforeEach(() => {
    Object.keys(M.connection.models).forEach((modelName) => {
      delete (M.connection.models as any)[modelName];
    });
  });

  it.each([
    ['string', z.string().min(6), 'hello'],
    ['string branded', z.string().min(6).brand(), 'hello'],
    ['string nullable (passing undefined)', z.string().nullable(), undefined],
    ['number', z.number().int(), 3.14],
    ['boolean', z.boolean(), 1],
    ['date', z.date().min(new Date(1)), new Date(0)],
    ['date (invalid)', z.date(), new Date('invalid')],
    ['literal', z.literal(42), 43],
    ['map', z.map(z.string(), z.number()), new Map([[1, '2']])],
    ['nan', z.nan(), 42],
    ['nan', z.nan(), Number.POSITIVE_INFINITY],
    ['null', z.null(), 'null'],
    ['union', z.union([z.string(), z.number()]), true],
    ['union w/ a nullable schema (passing undefined)', z.union([z.string().nullable(), z.number()]), undefined],
    ['enum', z.enum(['a', 'b', 'c']), 'd'],
    ['nativeEnum', z.nativeEnum({a: 1, b: 2, c: 3}), 4],
    ['record', z.record(z.string()), {a: 1}],
    ['tuple', z.tuple([z.number(), z.string(), z.date()]), [1, '2', '2022-01-01']],
    [
      'intersection',
      z.intersection(z.object({a: z.boolean(), b: z.string()}), z.object({c: z.number()})),
      {a: true, b: 'hello'},
    ],
    [
      'discriminated union',
      z.discriminatedUnion('type', [
        z.object({type: z.literal('a'), a: z.string()}),
        z.object({type: z.literal('b'), b: z.string()}),
      ]),
      {type: 'a', b: 'a'},
    ],
    ['array', z.array(z.union([z.string(), z.number()])), ['1', 2, true]],
    ['object', z.object({a: z.string(), b: z.number()}), {a: 1, b: '2'}],
    ['array of objects', z.object({a: z.string(), b: z.number()}).array().min(2), [{a: '1', b: 2}]],
  ] as const)(
    'Throws ValidationError if zod validation is not passed for type %s',
    (_, propSchema, value) => {
      const zodSchema = z.object({a: propSchema}).mongoose();

      const Model = M.model('test', toMongooseSchema(zodSchema));
      const instance = new Model({a: value});

      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    },
  );

  it.each([
    ['string', z.string().min(6), 'hello world!'],
    ['string branded', z.string().min(6).brand(), 'hello world!'],
    ['number', z.number().int(), 3],
    ['boolean', z.boolean(), true],
    ['date', z.date().min(new Date(1)), new Date(2)],
    ['literal', z.literal(42), 42],
    ['map', z.map(z.string(), z.number()), new Map([['1', 2]])],
    ['nan', z.nan(), Number.NaN],
    ['null', z.null(), null],
    ['nullable (passing string)', z.string().nullable(), 'hello world!'],
    ['nullable (passing null)', z.string().nullable(), null],
    ['union', z.union([z.string(), z.number()]), 'hello'],
    ['union w/ a nullable schema', z.union([z.string().nullable(), z.number()]), null],
    ['enum', z.enum(['a', 'b', 'c']), 'c'],
    ['nativeEnum', z.nativeEnum({a: 1, b: 2, c: 3}), 2],
    ['record', z.record(z.string()), {a: 'b'}],
    ['tuple', z.tuple([z.number(), z.string(), z.date()]), [1, '2', new Date('2022-01-01')]],
    [
      'intersection',
      z.intersection(z.object({a: z.boolean(), b: z.string()}), z.object({c: z.number()})),
      {a: true, b: 'hello', c: 42},
    ],
    [
      'discriminated union',
      z.discriminatedUnion('type', [
        z.object({type: z.literal('a'), a: z.string()}),
        z.object({type: z.literal('b'), b: z.string()}),
      ]),
      {type: 'a', a: 'a'},
    ],
    ['array', z.array(z.union([z.string(), z.number()])), ['1', 2, 'true']],
    ['object', z.object({a: z.string(), b: z.number()}), {a: '1', b: 2}],
    [
      'array of objects',
      z.object({a: z.string(), b: z.number()}).array().min(2),
      [
        {a: '1', b: 2},
        {a: '1', b: 2},
      ],
    ],
    ['any', z.any(), {a: [1, '2', [[]]], b: {c: {d: [42, {e: 'f'}]}}}],
    ['unknown', z.any(), {a: [1, '2', [[]]], b: {c: {d: [42, {e: 'f'}]}}}],
  ] as const)(
    'Does not throw ValidationError if zod validation succeeds for type "%s"',
    (_, propSchema, value) => {
      const zodSchema = z.object({a: propSchema}).mongoose();

      const mongooseSchema = toMongooseSchema(zodSchema);
      const Model = M.model('test', mongooseSchema);
      const instance = new Model({a: value});

      const validationResult = instance.validateSync();
      expect(validationResult).not.toBeInstanceOf(M.Error.ValidationError);
    },
  );

  it('Throws if either zod validation or custom validation is not passed', () => {
    const zodSchema = z
      .object({
        firstName: z
          .string()
          .min(1)
          .mongooseTypeOptions({
            validate: (value: string) => value.length >= 2,
          }),
        nickname: z
          .string()
          .min(5)
          .mongooseTypeOptions({
            validate: (value: string) => value.length >= 4,
          }),
      })
      .mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));
    const instance = new Model({firstName: 'N', nickname: 'nick'});

    expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
  });

  it('Does not throw ValidationError if both zod & custom valudation succeed', () => {
    const zodSchema = z
      .object({
        firstName: z
          .string()
          .min(1)
          .mongooseTypeOptions({
            validate: (value: string) => value.length >= 2,
          }),
        nickname: z
          .string()
          .min(6)
          .mongooseTypeOptions({
            validate: (value: string) => value.length >= 5,
          }),
      })
      .mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));
    const instance = new Model({firstName: 'Nick', nickname: 'nickname'});

    expect(instance.validateSync()).not.toBeInstanceOf(M.Error.ValidationError);
  });

  it('Does not perform value casting for numbers', () => {
    const zodSchema = z.object({a: z.number()}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    [
      '1',
      '',
      true,
      false,
      // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
      new Number(1),
      {
        valueOf() {
          return 2;
        },
      },
    ].forEach((badValue) => {
      const instance = new Model({a: badValue});
      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    });
  });

  it('Does not perform value casting for strings', () => {
    const zodSchema = z.object({a: z.string()}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    [
      {_id: 'a'},
      42,
      true,
      false,
      // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
      new String('hello'),
      {
        toString() {
          return '';
        },
      },
    ].forEach((badValue) => {
      const instance = new Model({a: badValue});
      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    });
  });

  it('Does not perform value casting for booleans', () => {
    const zodSchema = z.object({a: z.boolean()}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    // https://github.com/Automattic/mongoose/blob/df01ba6bdff9cae17697b72b0178492237a776bc/lib/cast/boolean.js#L31
    ['true', 1, '1', 'yes', 'false', 0, '0', 'no'].forEach((badValue) => {
      const instance = new Model({a: badValue});
      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    });
  });

  it('Does not perform value casting for dates', () => {
    const zodSchema = z.object({a: z.date()}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    [
      42,
      '1',
      {
        valueOf() {
          return 2;
        },
      },
    ].forEach((badValue) => {
      const instance = new Model({a: badValue});
      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    });
  });

  it('Does not cast non-arrays to arrays by default', () => {
    const zodSchema = z.object({a: z.any().array()}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    [1, '2', false, {}, new Map()].forEach((badValue) => {
      const instance = new Model({a: badValue});
      expect(instance.validateSync()).toBeInstanceOf(M.Error.ValidationError);
    });
  });

  it('Casts non-arrays to arrays if `castNonArrays: true` is provided', () => {
    const zodSchema = z
      .object({
        a: z.any().array().mongooseTypeOptions({castNonArrays: true}),
      })
      .strict()
      .mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));

    [1, '2', false, {}, new Map()].forEach((nonArray) => {
      const instance = new Model({a: nonArray});
      expect(instance.validateSync()).not.toBeInstanceOf(M.Error.ValidationError);
    });
  });
});
