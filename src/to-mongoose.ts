import M, {Document, Schema as MongooseSchema, SchemaOptions, SchemaTypeOptions} from 'mongoose';
import type z from 'zod';
import type {ZodSchema} from 'zod';
import {MongooseZodError} from './errors.js';
import {ZodMongoose} from './zod-extension.js';
import {isZodType, unwrapZodSchema, zodInstanceofOriginalClasses} from './zod-helpers.js';

class MongooseZodUniversalType extends M.SchemaType {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cast(value: any, _doc: Document<any, any, any>, _init: boolean, _prev?: any, _options?: any) {
    return value;
  }
}

Object.assign(M.Schema.Types, {
  MongooseZodUniversalType,
});

const isZodPrimitive = (zodSchema: z.ZodSchema) => {
  return (
    isZodType(zodSchema, 'ZodString') ||
    isZodType(zodSchema, 'ZodNumber') ||
    isZodType(zodSchema, 'ZodBoolean') ||
    isZodType(zodSchema, 'ZodDate') ||
    isZodType(zodSchema, 'ZodLiteral') ||
    isZodType(zodSchema, 'ZodNaN') ||
    isZodType(zodSchema, 'ZodNull')
  );
};

const addMongooseSchemaFields = (
  zodSchema: z.ZodSchema,
  monSchema: MongooseSchema,
  context: {
    fieldsStack?: string[];
    monSchemaOptions?: SchemaOptions;
    monTypeOptions?: SchemaTypeOptions<any>;
    typeKey?: string;
  },
): void => {
  const {fieldsStack = [], monSchemaOptions, monTypeOptions: monTypeOptionsFromSchema} = context;
  const addToField = fieldsStack.at(-1);
  const isRoot = addToField == null;
  const {schema: zodSchemaFinal, properties: schemaProperties} = unwrapZodSchema(zodSchema);
  const isRequired = !schemaProperties.isOptional && !isZodType(zodSchemaFinal, 'ZodNull');
  const monMetadata = schemaProperties.mongoose || {};

  const monTypeOptionsFromField = schemaProperties.mongooseTypeOptions;
  const monTypeOptions = {...monTypeOptionsFromField, ...monTypeOptionsFromSchema};

  const typeKey = (isRoot ? monSchemaOptions?.typeKey : context.typeKey) ?? 'type';

  const isFieldArray = 'array' in schemaProperties;
  const commonFieldOptions: SchemaTypeOptions<any> = {
    required: isRequired,
    ...('default' in schemaProperties
      ? {default: schemaProperties.default}
      : isFieldArray
      ? {default: undefined}
      : {}),
    ...(isFieldArray && {castNonArrays: false}),
    ...monTypeOptions,
  };
  let fieldType: any;

  const isUnionOfPritiveValues =
    isZodType(zodSchemaFinal, 'ZodUnion') &&
    (zodSchemaFinal._def.options as ZodSchema<any>[]).every((zs) => isZodPrimitive(zs));

  if (isZodType(zodSchemaFinal, 'ZodObject')) {
    const relevantSchema = isRoot
      ? monSchema
      : new MongooseSchema({}, {typeKey, ...monMetadata?.schemaOptions});
    for (const [key, S] of Object.entries(zodSchemaFinal._def.shape()) as [string, ZodSchema][]) {
      addMongooseSchemaFields(S, relevantSchema, {
        ...context,
        fieldsStack: [...fieldsStack, key],
        monTypeOptions: monMetadata.typeOptions?.[key],
        typeKey: monMetadata?.schemaOptions?.typeKey ?? typeKey,
      });
    }
    if (isRoot) {
      return;
    }
    if (!('_id' in commonFieldOptions)) {
      commonFieldOptions._id = false;
    }
    fieldType = relevantSchema;
  } else if (
    isZodPrimitive(zodSchemaFinal) ||
    isZodType(zodSchemaFinal, 'ZodEnum') ||
    isZodType(zodSchemaFinal, 'ZodNativeEnum') ||
    isUnionOfPritiveValues
  ) {
    fieldType = MongooseZodUniversalType;
  } else if (
    isZodType(zodSchemaFinal, 'ZodType') ||
    isZodType(zodSchemaFinal, 'ZodTypeAny') ||
    isZodType(zodSchemaFinal, 'ZodUnknown') ||
    isZodType(zodSchemaFinal, 'ZodRecord') ||
    isZodType(zodSchemaFinal, 'ZodUnion') ||
    isZodType(zodSchemaFinal, 'ZodTuple') ||
    isZodType(zodSchemaFinal, 'ZodDiscriminatedUnion') ||
    isZodType(zodSchemaFinal, 'ZodIntersection')
  ) {
    fieldType = M.Schema.Types.Mixed;
  } else if (isZodType(zodSchemaFinal, 'ZodMap')) {
    fieldType = M.Schema.Types.Map;
  } else if (isZodType(zodSchemaFinal, 'ZodAny')) {
    // Note: the key is the original schema, not unwrapped
    const instanceOfClass = zodInstanceofOriginalClasses.get(zodSchema);
    fieldType = instanceOfClass || M.Schema.Types.Mixed;
  }

  if (isRoot) {
    throw new MongooseZodError('You must provide object schema at root level');
  }

  // undefined, void, bigint, never, sets, promise, function, lazy, effects
  if (fieldType == null) {
    let addMsg = '';
    if (
      isZodType(zodSchemaFinal, 'ZodEffects') &&
      zodSchemaFinal._def.effect.type !== 'refinement'
    ) {
      addMsg = 'only refinements are supported';
    }
    const fieldPath = fieldsStack.join('.');
    const typeName = zodSchemaFinal.constructor.name;
    const errorMessage = `Path \`${fieldPath}\`: ${typeName} type is not supported${
      addMsg ? ` (${addMsg})` : ''
    }`;
    throw new MongooseZodError(errorMessage);
  }

  if (schemaProperties.array) {
    for (let i = 0; i < schemaProperties.array.wrapInArrayTimes; i++) {
      fieldType = [fieldType];
    }
  }

  monSchema.add({
    [addToField]: {
      ...commonFieldOptions,
      [typeKey]: fieldType,
    },
  });

  monSchema.paths[addToField]?.validate(function (value: any) {
    let schemaToValidate: ZodSchema<any> =
      schemaProperties.array?.originalArraySchema || zodSchemaFinal;

    // TODO not really useful
    // For strict validation of objects:
    schemaToValidate = isZodType(schemaToValidate, 'ZodObject')
      ? schemaToValidate.strict()
      : schemaToValidate;
    const valueToParse =
      value &&
      typeof value === 'object' &&
      'toObject' in value &&
      typeof value.toObject === 'function'
        ? value.toObject()
        : value;

    return schemaToValidate.parse(valueToParse), true;
  });
};

type MongooseSchemaTypeParameters<
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

export const toMongooseSchema = <Schema extends ZodMongoose<any, any>>(rootZodSchema: Schema) => {
  if (!(rootZodSchema instanceof ZodMongoose)) {
    throw new MongooseZodError('Root schema must be an instance of ZodMongoose');
  }

  const metadata = rootZodSchema._def;
  const schemaOptions = metadata?.mongoose.schemaOptions;

  const schema = new MongooseSchema<
    z.infer<Schema>,
    any,
    MongooseSchemaTypeParameters<Schema, 'InstanceMethods'>,
    MongooseSchemaTypeParameters<Schema, 'QueryHelpers'>,
    Partial<MongooseSchemaTypeParameters<Schema, 'TVirtuals'>>,
    MongooseSchemaTypeParameters<Schema, 'TStaticMethods'>
  >(
    {},
    {
      id: false,
      ...schemaOptions,
    },
  );

  addMongooseSchemaFields(rootZodSchema, schema, {monSchemaOptions: schemaOptions});

  return schema;
};
