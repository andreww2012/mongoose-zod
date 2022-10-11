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