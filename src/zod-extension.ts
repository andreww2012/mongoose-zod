import type {SchemaOptions, SchemaTypeOptions} from 'mongoose';
import {z} from 'zod';

// Doesn't produce `& Partial<{}>` in resulting type if T has no keys
type PartialLaconic<T> = {} extends T ? {} : Partial<T>;

export const MongooseTypeOptions = Symbol.for('MongooseTypeOptions');

export interface MongooseMetadata<
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> {
  typeOptions?: {
    [Field in keyof DocType]?: SchemaTypeOptions<DocType[Field]>;
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
    mongooseTypeOptions<T extends ZodSchema<any>>(this: T, options: SchemaTypeOptions<any>): T;
  }

  interface ZodObject<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    T extends z.ZodRawShape,
    UnknownKeys extends 'passthrough' | 'strict' | 'strip' = 'strip',
    Catchall extends z.ZodTypeAny = z.ZodTypeAny,
  > {
    mongoose: <
      O extends ZodObject<any, UnknownKeys, Catchall>,
      TInstanceMethods extends {} = {},
      QueryHelpers extends {} = {},
      TStaticMethods extends {} = {},
      TVirtuals extends {} = {},
    >(
      this: O,
      metadata: MongooseMetadata<
        O['_input'],
        TInstanceMethods,
        QueryHelpers,
        TStaticMethods,
        TVirtuals
      >,
    ) => ZodMongoose<O, O['_input'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
  }
}

if (!z.ZodObject.prototype.mongoose) {
  z.ZodObject.prototype.mongoose = function (metadata) {
    return ZodMongoose.create({mongoose: metadata, innerType: this});
  };
}

if (!z.ZodType.prototype.mongooseTypeOptions) {
  z.ZodType.prototype.mongooseTypeOptions = function (options) {
    this._def[MongooseTypeOptions] = options;
    return this;
  };
}
