import type {SchemaOptions, SchemaTypeOptions} from 'mongoose';
import {z} from 'zod';
import type {PartialLaconic} from './utils';

export const MongooseTypeOptions = Symbol.for('MongooseTypeOptions');

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

interface ZodMongooseDef<
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
    [MongooseTypeOptions]?: SchemaTypeOptions<any>;
  }

  interface ZodSchema {
    mongooseTypeOptions<T extends ZodSchema<any>>(
      this: T,
      options: SchemaTypeOptions<T['_output']>,
    ): T;
  }

  interface ZodObject<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    T extends z.ZodRawShape,
    UnknownKeys extends 'passthrough' | 'strict' | 'strip' = 'strip',
    Catchall extends z.ZodTypeAny = z.ZodTypeAny,
    Output = z.objectOutputType<T, Catchall>,
    Input = z.objectInputType<T, Catchall>,
  > {
    mongoose: <
      O extends ZodObject<T, UnknownKeys, Catchall, Output, Input>,
      TInstanceMethods extends {} = {},
      QueryHelpers extends {} = {},
      TStaticMethods extends {} = {},
      TVirtuals extends {} = {},
    >(
      this: O,
      metadata?: MongooseMetadata<
        O['_output'],
        TInstanceMethods,
        QueryHelpers,
        TStaticMethods,
        TVirtuals
      >,
    ) => ZodMongoose<O, O['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
  }
}

if (!z.ZodObject.prototype.mongoose) {
  z.ZodObject.prototype.mongoose = function (metadata = {}) {
    return ZodMongoose.create({mongoose: metadata, innerType: this});
  };
}

if (!z.ZodType.prototype.mongooseTypeOptions) {
  z.ZodType.prototype.mongooseTypeOptions = function (options) {
    this._def[MongooseTypeOptions] = {
      ...this._def[MongooseTypeOptions],
      ...options,
    };
    return this;
  };
}

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
