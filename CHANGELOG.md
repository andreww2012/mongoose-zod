## 0.1.0

- When using `.lean()`, for fields of `Buffer` type an actual `Buffer` instance is returned instead of `Binary`.
- Prevent `mongoose-lean-defaults` from setting `undefined` to the missing fields.
- Merge type options set multiple times with `.mongooseTypeOptions()`.
- Make sure `genTimestampsSchema` sets the correct `timestamps` schema option in addition.
- All generated mongoose schemas now have `strict` option set to `throw`. There's an option to override this behaviour for all the schemas or per a schema basis.

## 0.0.7
## 0.0.6

- Fixed an erroneous sub schema validation error if one of its fields has `Buffer` type.

## 0.0.5

- Fix the issue resulting in fields with custom types set via `mongooseZodCustomType` still having `Mixed` type in the resulting schema.
- Fields assigned a `Buffer` mongoose type now have a native `Buffer` TypeScript type.

## 0.0.4

- Fix ESM & DTS outputs.

## 0.0.3

- Add type-safe alternatives for `validate`/`required` type options: `mzValidate` and `mzRequired`.
- Set `minimize: false` in schema options by default.
- Detect if the following plugins are installed and automatically register them on created schemas: `mongoose-lean-virtuals`, `mongoose-lean-defaults`, `mongoose-lean-getters`.
- Set `virtuals: true`, `defaults: true` and `getters: true` automatically when using `.lean()` query method if respective plugins are installed as well as `versionKey: false`.

## 0.0.2

- Throw an error upon schema generation if zod's `.optional()` is used but mongoose's `required` set to true or vice versa.
- Switch to using native mongoose types for number/string/boolean/date with value casting disabled to fix type specific operators not recognized by mongoose.

## 0.0.1

Initial release.