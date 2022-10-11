import M, {Schema as MongooseSchema, SchemaOptions, SchemaTypeOptions} from 'mongoose';
import type z from 'zod';
import type {ZodSchema} from 'zod';
import {MongooseZodError} from './errors.js';
import {ZodMongoose} from './extensions.js';
import {
  MongooseSchemaTypeParameters,
  MongooseZodBoolean,
  MongooseZodDate,
  MongooseZodNumber,
  MongooseZodString,
  registerCustomMongooseZodTypes,
} from './mongoose-helpers.js';
import {getValidEnumValues, tryImportModule} from './utils.js';
import {ZodTypes, isZodType, unwrapZodSchema, zodInstanceofOriginalClasses} from './zod-helpers.js';

registerCustomMongooseZodTypes();

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

  const mzOptions = [
    ['validate', monTypeOptions.mzValidate],
    ['required', monTypeOptions.mzRequired],
  ] as const;
  mzOptions.forEach(([origName]) => {
    const mzName = `mz${origName[0]?.toUpperCase()}${origName.slice(1)}`;
    if (mzName in monTypeOptions) {
      if (origName in monTypeOptions) {
        throwError(`Can't have both "${mzName}" and "${origName}" set`);
      }
      monTypeOptions[origName] = monTypeOptions[mzName];
      delete monTypeOptions[mzName];
    }
  });

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

  // eslint-disable-next-line @typescript-eslint/ban-types
  const getFixedOptionFn = (fn: Function) =>
    function (this: unknown, ...args: any[]) {
      const thisFixed = this && this instanceof M.Document ? this : undefined;
      return fn.apply(thisFixed, args);
    };
  const [[, mzValidate], [, mzRequired]] = mzOptions;

  if (mzValidate != null) {
    let mzv = mzValidate;
    if (typeof mzv === 'function') {
      mzv = getFixedOptionFn(mzv);
    } else if (!Array.isArray(mzv) && typeof mzv === 'object' && !(mzv instanceof RegExp)) {
      mzv.validator = getFixedOptionFn(mzv.validator);
    } else if (Array.isArray(mzv) && !(mzv[0] instanceof RegExp && typeof mzv[1] === 'string')) {
      const [firstElem, secondElem] = mzv;
      if (typeof firstElem === 'function' && typeof secondElem === 'string') {
        commonFieldOptions.mzValidate = [getFixedOptionFn(firstElem), secondElem];
      }
    }
    commonFieldOptions.validate = mzv;
  }
  if (mzRequired != null) {
    let mzr = mzRequired;
    if (typeof mzr === 'function') {
      mzr = getFixedOptionFn(mzr);
    } else if (Array.isArray(mzr) && typeof mzr[0] === 'function') {
      const [probablyFn] = mzr;
      if (typeof probablyFn === 'function') {
        mzr[0] = getFixedOptionFn(probablyFn);
      }
    }
    commonFieldOptions.required = mzr;
  }

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
  let fieldType: any;
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
    const instanceOfClass = zodInstanceofOriginalClasses.get(zodSchemaFinal);
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

const mlvPlugin = tryImportModule('mongoose-lean-virtuals', import.meta);
const mldPlugin = tryImportModule('mongoose-lean-defaults', import.meta);
const mlgPlugin = tryImportModule('mongoose-lean-getters', import.meta);

const originalLean = M.Query.prototype.lean;

export const toMongooseSchema = <Schema extends ZodMongoose<any, any>>(
  rootZodSchema: Schema,
  options: {
    disablePlugins?: {
      leanVirtuals?: boolean;
      leanDefaults?: boolean;
      leanGetters?: boolean;
    };
  } = {},
) => {
  if (!(rootZodSchema instanceof ZodMongoose)) {
    throw new MongooseZodError('Root schema must be an instance of ZodMongoose');
  }

  const metadata = rootZodSchema._def;
  const schemaOptions = metadata?.mongoose.schemaOptions;

  const dp = options?.disablePlugins;
  const addMLVPlugin = mlvPlugin && !dp?.leanVirtuals;
  const addMLDPlugin = mldPlugin && !dp?.leanDefaults;
  const addMLGPlugin = mlgPlugin && !dp?.leanGetters;

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
      minimize: false,
      ...schemaOptions,
      query: {
        lean(leanOptions?: any) {
          return originalLean.call(
            this,
            typeof leanOptions === 'object' || leanOptions == null
              ? {
                  ...(addMLVPlugin && {virtuals: true}),
                  ...(addMLDPlugin && {defaults: true}),
                  ...(addMLGPlugin && {getters: true}),
                  versionKey: false,
                  ...leanOptions,
                }
              : leanOptions,
          );
        },
        ...schemaOptions?.query,
      },
    },
  );

  addMongooseSchemaFields(rootZodSchema, schema, {monSchemaOptions: schemaOptions});

  addMLVPlugin && schema.plugin(mlvPlugin.module);
  addMLDPlugin && schema.plugin(mldPlugin.module?.default);
  addMLGPlugin && schema.plugin(mlgPlugin.module);

  return schema;
};
