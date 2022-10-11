import M from 'mongoose';
import {z} from 'zod';
import type {ZodMongoose} from './extensions';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export const genTimestampsSchema = <CrAt, UpAt>(
  createdAtField: StringLiteral<CrAt>,
  updatedAtField: StringLiteral<UpAt>,
) =>
  z.object({
    [createdAtField]: z
      .date()
      .default(new Date())
      .mongooseTypeOptions({immutable: true, index: true}),
    [updatedAtField]: z.date().default(new Date()).mongooseTypeOptions({index: true}),
  } as {
    [_ in StringLiteral<CrAt | UpAt>]: z.ZodDefault<z.ZodDate>;
  });

export type MongooseSchemaTypeParameters<
  T,
  Parameter extends 'InstanceMethods' | 'QueryHelpers' | 'TStaticMethods' | 'TVirtuals',
> = T extends ZodMongoose<
  any,
  any,
  infer InstanceMethods,
  infer QueryHelpers,
  infer TStaticMethods,
  infer TVirtuals
>
  ? {
      InstanceMethods: InstanceMethods;
      QueryHelpers: QueryHelpers;
      TStaticMethods: TStaticMethods;
      TVirtuals: TVirtuals;
    }[Parameter]
  : {};

const noCastFn = (value: any) => value;

export class MongooseZodBoolean extends M.SchemaTypes.Boolean {
  static schemaName = 'MongooseZodBoolean' as 'Boolean';
  cast = noCastFn;
}

export class MongooseZodDate extends M.SchemaTypes.Date {
  static schemaName = 'MongooseZodDate' as 'Date';
  cast = noCastFn;
}

export class MongooseZodNumber extends M.SchemaTypes.Number {
  static schemaName = 'MongooseZodNumber' as 'Number';
  cast = noCastFn;
}

export class MongooseZodString extends M.SchemaTypes.String {
  static schemaName = 'MongooseZodString' as 'String';
  cast = noCastFn;
}

export const registerCustomMongooseZodTypes = (): void => {
  Object.assign(M.Schema.Types, {
    MongooseZodBoolean,
    MongooseZodDate,
    MongooseZodNumber,
    MongooseZodString,
  });
};
