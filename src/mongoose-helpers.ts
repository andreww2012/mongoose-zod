import {z} from 'zod';

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
