/* eslint-disable @typescript-eslint/prefer-function-type */
import type {SchemaOptions, SchemaTypeOptions} from 'mongoose';
import {type ZodObject, z} from 'zod';
import type {PartialLaconic} from './types.js';

export const MongooseTypeOptionsSymbol = Symbol.for('MongooseTypeOptions');
export const MongooseSchemaOptionsSymbol = Symbol.for('MongooseSchemaOptions');

export interface MongooseMetadata<
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> {
  typeOptions?: {
    [Field in keyof DocType]?: SchemaTypeOptions<DocType[Field], DocType>;
  };
  schemaOptions?: Omit<
    SchemaOptions<any, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>,
    // Actually does not work
    'castNonArrays'
  >;
}

export interface ZodMongooseDef<
  ZodType extends z.ZodTypeAny,
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> extends z.ZodTypeDef {
  innerType: ZodType;
  mongoose: MongooseMetadata<DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
}

export class ZodMongoose<
  ZodType extends z.ZodTypeAny,
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> extends z.ZodType<
  DocType & PartialLaconic<TVirtuals>,
  ZodMongooseDef<ZodType, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>
> {
  _parse(input: z.ParseInput): z.ParseReturnType<this['_output']> {
    return z.OK(input.data);
  }

  static create<
    ZodType extends z.ZodObject<any>,
    DocType,
    TInstanceMethods extends {} = {},
    QueryHelpers extends {} = {},
    TStaticMethods extends {} = {},
    TVirtuals extends {} = {},
  >(
    def: ZodMongooseDef<
      ZodType,
      DocType,
      TInstanceMethods,
      QueryHelpers,
      TStaticMethods,
      TVirtuals
    >,
  ) {
    return new ZodMongoose<
      ZodType,
      DocType,
      TInstanceMethods,
      QueryHelpers,
      TStaticMethods,
      TVirtuals
    >(def);
  }
}

declare module 'zod' {
  interface ZodTypeDef {
    [MongooseTypeOptionsSymbol]?: SchemaTypeOptions<any>;
    [MongooseSchemaOptionsSymbol]?: SchemaOptions;
  }

  interface ZodSchema {
    mongooseTypeOptions: <T extends ZodSchema>(
      this: T,
      options: SchemaTypeOptions<T['_output']>,
    ) => T;
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface ZodObject<
    T extends z.ZodRawShape,
    UnknownKeys extends 'passthrough' | 'strict' | 'strip' = 'strip',
    Catchall extends z.ZodTypeAny = z.ZodTypeAny,
    Output = z.objectOutputType<T, Catchall>,
    Input = z.objectInputType<T, Catchall>,
  > {
    mongoose: <
      ZO extends ZodObject<T, UnknownKeys, Catchall, Output, Input>,
      TInstanceMethods extends {} = {},
      QueryHelpers extends {} = {},
      TStaticMethods extends {} = {},
      TVirtuals extends {} = {},
    >(
      this: ZO,
      metadata?: MongooseMetadata<
        ZO['_output'],
        TInstanceMethods,
        QueryHelpers,
        TStaticMethods,
        TVirtuals
      >,
    ) => ZodMongoose<ZO, ZO['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
  }
}

export const toZodMongooseSchema = function <
  ZO extends ZodObject<any>,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
>(
  zObject: ZO,
  metadata: MongooseMetadata<
    ZO['_output'],
    TInstanceMethods,
    QueryHelpers,
    TStaticMethods,
    TVirtuals
  > = {},
) {
  return ZodMongoose.create({mongoose: metadata, innerType: zObject});
};

export const addMongooseToZodPrototype = (toZ: typeof z | null) => {
  if (toZ === null) {
    // eslint-disable-next-line disable-autofix/@typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-condition
    if (z.ZodObject.prototype.mongoose !== undefined) {
      // @ts-expect-error `mongoose` might not exists despite what the types say
      delete z.ZodObject.prototype.mongoose;
    }
    // eslint-disable-next-line disable-autofix/@typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-condition
  } else if (toZ.ZodObject.prototype.mongoose === undefined) {
    toZ.ZodObject.prototype.mongoose = function (metadata = {}) {
      return toZodMongooseSchema(this, metadata);
    };
  }
};

export const addMongooseTypeOptions = function <T extends z.ZodSchema>(
  zObject: T,
  options: SchemaTypeOptions<T['_output']>,
) {
  zObject._def[MongooseTypeOptionsSymbol] = {
    ...zObject._def[MongooseTypeOptionsSymbol],
    ...options,
  };
  return zObject;
};

export const addMongooseTypeOptionsToZodPrototype = (toZ: typeof z | null) => {
  if (toZ === null) {
    // eslint-disable-next-line disable-autofix/@typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-condition
    if (z.ZodType.prototype.mongooseTypeOptions !== undefined) {
      // @ts-expect-error `mongoose` might not exists despite what the types say
      delete z.ZodType.prototype.mongooseTypeOptions;
    }
    // eslint-disable-next-line disable-autofix/@typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-condition
  } else if (toZ.ZodType.prototype.mongooseTypeOptions === undefined) {
    toZ.ZodType.prototype.mongooseTypeOptions = function (options: SchemaTypeOptions<any, any>) {
      return addMongooseTypeOptions(this, options);
    };
  }
};

declare module 'mongoose' {
  interface MZValidateFn<T, ThisType> {
    (this: ThisType, value: T): boolean;
  }

  interface MZLegacyAsyncValidateFn<T, ThisType> {
    (this: ThisType, value: T, done: (result: boolean) => void): void;
  }

  interface MZAsyncValidateFn<T, ThisType> {
    (this: ThisType, value: T): Promise<boolean>;
  }

  interface MZValidateOpts<T, ThisType> {
    msg?: string;
    message?: string | ValidatorMessageFn;
    type?: string;
    validator:
      | MZValidateFn<T, ThisType>
      | MZLegacyAsyncValidateFn<T, ThisType>
      | MZAsyncValidateFn<T, ThisType>;
  }

  type MZSchemaValidator<T, ThisType> =
    | RegExp
    | [RegExp, string]
    | MZValidateFn<T, ThisType>
    | [MZValidateFn<T, ThisType>, string]
    | MZValidateOpts<T, ThisType>;

  interface MZRequiredFn<ThisType> {
    (this: ThisType): boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface SchemaTypeOptions<T, ThisType = any> {
    mzValidate?: MZSchemaValidator<Exclude<T, undefined>, ThisType | undefined>;
    mzRequired?:
      | boolean
      | MZRequiredFn<ThisType | null>
      | [boolean, string]
      | [MZRequiredFn<ThisType | null>, string];
  }
}

export {z} from 'zod';
