import M from 'mongoose';
import {z} from 'zod';
import type {ZodSchema, ZodTypeAny} from 'zod';
import {
  MongooseMetadata,
  MongooseSchemaOptionsSymbol,
  MongooseTypeOptionsSymbol,
  ZodMongoose,
} from './extensions.js';

export interface ZodTypes {
  ZodAny: z.ZodAny;
  ZodArray: z.ZodArray<any>;
  ZodBigInt: z.ZodBigInt;
  ZodBoolean: z.ZodBoolean;
  ZodBranded: z.ZodBranded<any, any>;
  ZodDate: z.ZodDate;
  ZodDefault: z.ZodDefault<any>;
  ZodEffects: z.ZodEffects<any>;
  ZodEnum: z.ZodEnum<any>;
  ZodFunction: z.ZodFunction<any, any>;
  ZodIntersection: z.ZodIntersection<any, any>;
  ZodLazy: z.ZodLazy<any>;
  ZodLiteral: z.ZodLiteral<any>;
  ZodMap: z.ZodMap;
  ZodNaN: z.ZodNaN;
  ZodNativeEnum: z.ZodNativeEnum<any>;
  ZodNull: z.ZodNull;
  ZodNullable: z.ZodNullable<any>;
  ZodNumber: z.ZodNumber;
  ZodObject: z.ZodObject<any>;
  ZodOptional: z.ZodOptional<any>;
  ZodUndefined: z.ZodUndefined;
  ZodPromise: z.ZodPromise<any>;
  ZodRecord: z.ZodRecord;
  ZodSet: z.ZodSet;
  ZodSchema: z.ZodSchema;
  ZodString: z.ZodString;
  ZodTuple: z.ZodTuple<any>;
  ZodUnion: z.ZodUnion<any>;
  ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<any, any, any>;
  ZodUnknown: z.ZodUnknown;
  ZodVoid: z.ZodVoid;

  ZodType: z.ZodType;
  ZodTypeAny: z.ZodTypeAny;
}

export const isZodType = <TypeName extends keyof ZodTypes>(
  schema: object,
  typeName: TypeName,
): schema is ZodTypes[TypeName] => {
  return schema.constructor.name === typeName;
};

interface SchemaFeatures {
  default?: any;
  isOptional?: boolean;
  unknownKeys?: 'strict' | 'passthrough';
  unionSchemaType?: keyof ZodTypes;
  array?: {
    wrapInArrayTimes: number;
    originalArraySchema: z.ZodArray<any>;
  };
  mongoose?: MongooseMetadata<any>;
  mongooseTypeOptions?: M.SchemaTypeOptions<any>;
  mongooseSchemaOptions?: M.SchemaOptions;
}

export const unwrapZodSchema = (
  schema: ZodSchema<any>,
  options: {doNotUnwrapArrays?: boolean} = {},
  _features: SchemaFeatures = {},
): {schema: ZodSchema<any>; features: SchemaFeatures} => {
  const monTypeOptions = schema._def[MongooseTypeOptionsSymbol];
  _features.mongooseTypeOptions ||= monTypeOptions;
  const monSchemaOptions = schema._def[MongooseSchemaOptionsSymbol];
  _features.mongooseSchemaOptions ||= monSchemaOptions;

  if (isZodType(schema, 'ZodUnion')) {
    const unionSchemaTypes = schema._def.options.map((v: z.ZodSchema) => v.constructor.name);
    if (new Set(unionSchemaTypes).size === 1) {
      _features.unionSchemaType ??= unionSchemaTypes[0] as keyof ZodTypes;
    }
  }

  if (schema instanceof ZodMongoose) {
    return unwrapZodSchema(schema._def.innerType, options, {
      ..._features,
      mongoose: schema._def.mongoose,
    });
  }

  // Remove `strict` or `passthrough` feature - set to strip mode (default)
  if (isZodType(schema, 'ZodObject')) {
    const unknownKeys = schema._def.unknownKeys as string;
    if (unknownKeys === 'strict' || unknownKeys === 'passthrough') {
      return unwrapZodSchema(schema.strip(), options, {..._features, unknownKeys});
    }
  }

  if (isZodType(schema, 'ZodOptional')) {
    return unwrapZodSchema(schema.unwrap(), options, {..._features, isOptional: true});
  }

  if (isZodType(schema, 'ZodDefault')) {
    return unwrapZodSchema(
      schema._def.innerType,
      options,
      // Only top-most default value ends up being used
      // (in case of `<...>.default(1).default(2)`, `2` will be used as the default value)
      'default' in _features ? _features : {..._features, default: schema._def.defaultValue()},
    );
  }

  if (isZodType(schema, 'ZodBranded') || isZodType(schema, 'ZodNullable')) {
    return unwrapZodSchema(schema.unwrap(), options, {..._features});
  }

  if (isZodType(schema, 'ZodEffects') && schema._def.effect.type === 'refinement') {
    return unwrapZodSchema(schema._def.schema, options, _features);
  }

  if (isZodType(schema, 'ZodArray') && !options.doNotUnwrapArrays) {
    const wrapInArrayTimes = Number(_features.array?.wrapInArrayTimes || 0) + 1;
    return unwrapZodSchema(schema._def.type, options, {
      ..._features,
      array: {
        ..._features.array,
        wrapInArrayTimes,
        originalArraySchema: _features.array?.originalArraySchema || schema,
      },
    });
  }

  return {schema, features: _features};
};

export const zodInstanceofOriginalClasses = new WeakMap<ZodTypeAny, new (...args: any[]) => any>();

export const mongooseZodCustomType = <T extends keyof typeof M.Types & keyof typeof M.Schema.Types>(
  typeName: T,
  params?: Parameters<ZodTypeAny['refine']>[1],
) => {
  const instanceClass = typeName === 'Buffer' ? Buffer : M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];

  type TFixed = T extends 'Buffer' ? BufferConstructor : typeof M.Types[T];

  const result = z.instanceof(instanceClass, params) as z.ZodType<
    InstanceType<TFixed>,
    z.ZodTypeDef,
    InstanceType<TFixed>
  >;
  zodInstanceofOriginalClasses.set((result as z.ZodEffects<any>)._def.schema, typeClass);

  return result;
};
