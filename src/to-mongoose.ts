import M, {Schema as MongooseSchema, SchemaOptions, SchemaTypeOptions} from 'mongoose';
import type z from 'zod';
import type {ZodSchema} from 'zod';
import {MongooseZodError} from './errors.js';
import {getValidEnumValues} from './utils.js';
import {ZodMongoose} from './zod-extension.js';
import {ZodTypes, isZodType, unwrapZodSchema, zodInstanceofOriginalClasses} from './zod-helpers.js';

const noCastFn = (value: any) => value;

class MongooseZodBoolean extends M.SchemaTypes.Boolean {
  static schemaName = 'MongooseZodBoolean' as 'Boolean';
  cast = noCastFn;
}

class MongooseZodDate extends M.SchemaTypes.Date {
  static schemaName = 'MongooseZodDate' as 'Date';
  cast = noCastFn;
}

class MongooseZodNumber extends M.SchemaTypes.Number {
  static schemaName = 'MongooseZodNumber' as 'Number';
  cast = noCastFn;
}

class MongooseZodString extends M.SchemaTypes.String {
  static schemaName = 'MongooseZodString' as 'String';
  cast = noCastFn;
}

Object.assign(M.Schema.Types, {
  MongooseZodBoolean,
  MongooseZodDate,
  MongooseZodNumber,
  MongooseZodString,
});

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
  const fieldPath = fieldsStack.join('.');
  const isRoot = addToField == null;

  const throwError = (message: string, noPath?: boolean) => {
    throw new MongooseZodError(`${noPath ? '' : `Path \`${fieldPath}\`: `}${message}`);
  };

  const {schema: zodSchemaFinal, properties: schemaProperties} = unwrapZodSchema(zodSchema);
  const monMetadata = schemaProperties.mongoose || {};

  const monTypeOptionsFromField = schemaProperties.mongooseTypeOptions;
  const monTypeOptions = {...monTypeOptionsFromField, ...monTypeOptionsFromSchema};

  const isRequired = !schemaProperties.isOptional && !isZodType(zodSchemaFinal, 'ZodNull');
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

  if (!isRequired) {
    if (commonFieldOptions.required === true) {
      throwError("Can't have `required` set to true and `.optional()` used");
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (commonFieldOptions.required !== true) {
      throwError("Can't have `required` set to anything but true if `.optional()` not used");
    }
  }

  const {Mixed} = M.Schema.Types;
  let errMsgAddendum = '';

  let unionSchemaType: keyof ZodTypes | undefined;
  if (isZodType(zodSchemaFinal, 'ZodUnion')) {
    const unionSchemaTypes = zodSchemaFinal._def.options.map(
      (v: z.ZodSchema) => v.constructor.name,
    );
    if (new Set(unionSchemaTypes).size === 1) {
      unionSchemaType = unionSchemaTypes[0] as keyof ZodTypes;
    }
  }

  const typeKey = (isRoot ? monSchemaOptions?.typeKey : context.typeKey) ?? 'type';
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
  } else if (isZodType(zodSchemaFinal, 'ZodNumber') || unionSchemaType === 'ZodNumber') {
    fieldType = MongooseZodNumber;
  } else if (isZodType(zodSchemaFinal, 'ZodString') || unionSchemaType === 'ZodString') {
    fieldType = MongooseZodString;
  } else if (isZodType(zodSchemaFinal, 'ZodDate') || unionSchemaType === 'ZodDate') {
    fieldType = MongooseZodDate;
  } else if (isZodType(zodSchemaFinal, 'ZodBoolean') || unionSchemaType === 'ZodBoolean') {
    fieldType = MongooseZodBoolean;
  } else if (isZodType(zodSchemaFinal, 'ZodLiteral')) {
    const literalValue = zodSchemaFinal._def.value;
    const literalJsType = typeof literalValue;
    switch (literalJsType) {
      case 'boolean': {
        fieldType = MongooseZodBoolean;
        break;
      }
      case 'number': {
        fieldType = Number.isNaN(literalValue)
          ? Mixed
          : Number.isFinite(literalValue)
          ? MongooseZodNumber
          : undefined;
        break;
      }
      case 'string': {
        fieldType = MongooseZodString;
        break;
      }
      case 'object': {
        if (!literalValue) {
          fieldType = Mixed;
        }
        errMsgAddendum = 'object literals are not supported';
        break;
      }
      default: {
        errMsgAddendum = 'only boolean, number, string or null literals are supported';
      }
    }
  } else if (isZodType(zodSchemaFinal, 'ZodEnum')) {
    const enumValues = zodSchemaFinal._def.values;
    if (
      Array.isArray(enumValues) &&
      enumValues.length > 0 &&
      enumValues.every((v) => typeof v === 'string')
    ) {
      fieldType = MongooseZodString;
    } else {
      errMsgAddendum = 'only nonempty zod enums with string values are supported';
    }
  } else if (isZodType(zodSchemaFinal, 'ZodNativeEnum')) {
    const enumValues = getValidEnumValues(zodSchemaFinal._def.values);
    const valuesJsTypes = [...new Set(enumValues.map((v) => typeof v))];
    if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'number') {
      fieldType = MongooseZodNumber;
    } else if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'string') {
      fieldType = MongooseZodString;
    } else if (
      valuesJsTypes.length === 2 &&
      (['string', 'number'] as const).every((t) => valuesJsTypes.includes(t))
    ) {
      fieldType = Mixed;
    } else {
      errMsgAddendum = 'only nonempty native enums with number and strings values are supported';
    }
  } else if (isZodType(zodSchema, 'ZodNaN') || isZodType(zodSchema, 'ZodNull')) {
    fieldType = Mixed;
  } else if (isZodType(zodSchemaFinal, 'ZodMap')) {
    fieldType = Map;
  } else if (isZodType(zodSchemaFinal, 'ZodAny')) {
    // Note: the key is the original schema, not unwrapped
    const instanceOfClass = zodInstanceofOriginalClasses.get(zodSchema);
    fieldType = instanceOfClass || Mixed;
  } else if (isZodType(zodSchemaFinal, 'ZodEffects')) {
    // `refinement` effects are already unwrapped at this stage
    if (zodSchemaFinal._def.effect.type !== 'refinement') {
      errMsgAddendum = 'only refinements are supported';
    }
  } else if (
    isZodType(zodSchemaFinal, 'ZodUnknown') ||
    isZodType(zodSchemaFinal, 'ZodRecord') ||
    isZodType(zodSchemaFinal, 'ZodUnion') ||
    isZodType(zodSchemaFinal, 'ZodTuple') ||
    isZodType(zodSchemaFinal, 'ZodDiscriminatedUnion') ||
    isZodType(zodSchemaFinal, 'ZodIntersection') ||
    isZodType(zodSchemaFinal, 'ZodTypeAny') ||
    isZodType(zodSchemaFinal, 'ZodType')
  ) {
    fieldType = Mixed;
  }

  if (isRoot) {
    throw new MongooseZodError('You must provide object schema at root level');
  }

  // undefined, void, bigint, never, sets, promise, function, lazy, effects
  if (fieldType == null) {
    const typeName = zodSchemaFinal.constructor.name;
    throwError(`${typeName} type is not supported${errMsgAddendum ? ` (${errMsgAddendum})` : ''}`);
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
