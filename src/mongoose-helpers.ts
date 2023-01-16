import M from 'mongoose';
import {z} from 'zod';
import {MongooseZodError} from './errors';
import {MongooseSchemaOptionsSymbol, ZodMongoose} from './extensions';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

const DateFieldZod = () => z.date().default(new Date());

export const genTimestampsSchema = <CrAt = 'createdAt', UpAt = 'updatedAt'>(
  createdAtField: StringLiteral<CrAt | 'createdAt'> | null = 'createdAt',
  updatedAtField: StringLiteral<UpAt | 'updatedAt'> | null = 'updatedAt',
) => {
  if (createdAtField != null && updatedAtField != null && createdAtField === updatedAtField) {
    throw new MongooseZodError('`createdAt` and `updatedAt` fields must be different');
  }

  const schema = z.object({
    ...(createdAtField != null && {
      [createdAtField]: DateFieldZod().mongooseTypeOptions({immutable: true, index: true}),
    }),
    ...(updatedAtField != null && {
      [updatedAtField]: DateFieldZod().mongooseTypeOptions({index: true}),
    }),
  } as {
    [_ in StringLiteral<NonNullable<CrAt | UpAt>>]: z.ZodDefault<z.ZodDate>;
  });
  schema._def[MongooseSchemaOptionsSymbol] = {
    ...schema._def[MongooseSchemaOptionsSymbol],
    timestamps: {
      createdAt: createdAtField == null ? false : createdAtField,
      updatedAt: updatedAtField == null ? false : updatedAtField,
    },
  };
  return schema;
};

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

export const bufferMongooseGetter = (value: unknown) =>
  value instanceof M.mongo.Binary ? value.buffer : value;
