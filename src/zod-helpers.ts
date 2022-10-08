import M from 'mongoose';
import {z} from 'zod';
import type {ZodSchema, ZodTypeAny} from 'zod';
import {MongooseMetadata, MongooseTypeOptions, ZodMongoose} from './zod-extension.js';

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

interface SchemaProperties {
  default?: any;
  isOptional?: boolean;
  array?: {
    wrapInArrayTimes: number;
    originalArraySchema: z.ZodArray<any>;
  };
  mongoose?: MongooseMetadata<any>;
  mongooseTypeOptions?: M.SchemaTypeOptions<any>;
}

export const unwrapZodSchema = (
  schema: ZodSchema<any>,
  options: {doNotUnwrapArrays?: boolean} = {},
  _properties: SchemaProperties = {},
): {schema: ZodSchema<any>; properties: SchemaProperties} => {
  const monTypeOptions = schema._def[MongooseTypeOptions];
  _properties.mongooseTypeOptions ||= monTypeOptions;

  if (schema instanceof ZodMongoose) {
    return unwrapZodSchema(schema._def.innerType, options, {
      ..._properties,
      mongoose: schema._def.mongoose,
    });
  }

  if (isZodType(schema, 'ZodOptional')) {
    return unwrapZodSchema(schema.unwrap(), options, {..._properties, isOptional: true});
  }

  if (isZodType(schema, 'ZodDefault')) {
    return unwrapZodSchema(
      schema._def.innerType,
      options,
      // Only top-most default value ends up being used
      // (in case of `<...>.default(1).default(2)`, `2` will be used as the default value)
      'default' in _properties
        ? _properties
        : {..._properties, default: schema._def.defaultValue()},
    );
  }

  if (isZodType(schema, 'ZodBranded') || isZodType(schema, 'ZodNullable')) {
    return unwrapZodSchema(schema.unwrap(), options, {..._properties});
  }

  if (isZodType(schema, 'ZodEffects') && schema._def.effect.type === 'refinement') {
    return unwrapZodSchema(schema._def.schema, options, _properties);
  }

  if (isZodType(schema, 'ZodArray') && !options.doNotUnwrapArrays) {
    const wrapInArrayTimes = Number(_properties.array?.wrapInArrayTimes || 0) + 1;
    return unwrapZodSchema(schema._def.type, options, {
      ..._properties,
      array: {
        ..._properties.array,
        wrapInArrayTimes,
        originalArraySchema: _properties.array?.originalArraySchema || schema,
      },
    });
  }

  return {schema, properties: _properties};
};

export const zodInstanceofOriginalClasses = new WeakMap<ZodTypeAny, new (...args: any[]) => any>();

export const zodMongooseCustomType = <T extends keyof typeof M.Types & keyof typeof M.Schema.Types>(
  typeName: T,
  params?: Parameters<ZodTypeAny['refine']>[1],
) => {
  const instanceClass = M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];

  const result = z.instanceof(instanceClass, params);
  zodInstanceofOriginalClasses.set(result, typeClass);

  return result;
};
