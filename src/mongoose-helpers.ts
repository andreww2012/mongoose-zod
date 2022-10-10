import {z} from 'zod';
import type {ZodMongoose} from './zod-extension';

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
