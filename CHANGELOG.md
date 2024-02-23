## 0.1.2

*This is likely going to be the last version that supports mongoose < 6.8.*

- Define explicit [entry points via `exports`](https://nodejs.org/api/packages.html#package-entry-points) and avoid using non-standard `module` field.
- Clarify that `mongoose` >=6.8 versions are **not** supported due to [the breaking change](https://github.com/Automattic/mongoose/commit/68c0329f908a284e93afafede0bd42bd73c70efa?diff=split#diff-ddef51cacff5851e3055f40c3e1fa31434b58d9fc081e101199136fbd526d34eL10-L13) that removed the first generic parameter of `SchemaOptions` type.
- Correctly handle nullable fields (fixes #3).
- Do not create manually corresponding fields in a schema with `createdAt`/`updatedAt` fields generator as it causes a error upon saving an existing document in a `strict: 'throw'` mode.

## 0.1.1

- Added the ability to opt out of zod prototype extension and set the default `toMongooseSchema` options in `setup` function.

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