# mongoose-zod

A library which allows to author [mongoose](https://github.com/Automattic/mongoose) ("a MongoDB object modeling tool") schemas using [zod](https://github.com/colinhacks/zod) ("a TypeScript-first schema declaration and validation library").

## Purpose

Declaring mongoose schemas in TypeScript environment has always been tricky in terms of getting the most out of type safety:
* You either have to first declare an interface representing a document in MongoDB and then create a schema corresponding to that interface (you get no type safety at all - even the offical mongoose documentation says that "you as the developer are responsible for ensuring that your document interface lines up with your Mongoose schema")
* Or reverse things by using `mongoose.InferSchemaType<typeof schema>` which is far from ideal (impossible to narrow types, doesn't support TS enums, doesn't know about virtuals, has problems with fields named `type`, ...)
* Finally, you can use [typegoose](https://github.com/typegoose/typegoose) which is based on legacy decorators proposal and generally poorly infers types.

This library aims to solve many of the aforementioned problems utilizing `zod` as a schema authoring tool.

## Installation

⚠️ Please **do not forget** to read the [caveats](#caveats) section when you're done with the main documentation.

Install the package from [npm](https://www.npmjs.com/package/mongoose-zod):

```shell
npm i mongoose-zod
```

### ⚠️ Important installation notes

This package has [peer dependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#peerdependencies) being `mongoose` and `zod` as well as [optional peer dependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#peerdependenciesmeta) being a number of mongoose plugins which automatically added to schemas created with `mongoose-zod` if found.

- Starting from version 7, [NPM automatically installs peer dependencies](https://github.blog/2020-10-13-presenting-v7-0-0-of-the-npm-cli/). Keep an eye on installed peer dependencies' versions!
- Consequently, you need to **install required peer dependencies yourself** if you're using NPM <7.
- There was a bug [in some of the 7.x.x versions of NPM resulting in optional peer dependencies being installed automatically too](https://github.com/npm/feedback/discussions/225). Please check if optional peer dependencies were not installed if you don't need them (or use [--legacy-peer-deps flag](https://docs.npmjs.com/cli/v7/using-npm/config#legacy-peer-deps) when installing dependencies or this package to skip installing *all* peer dependencies and then install all required peer dependencies yourself).
- As of October 2022, the latest NPM version, `8.19.2`, [does NOT remove optional peer dependencies after uninstalling them](https://github.com/npm/cli/issues/4737). Which also may mean they will still be considered "found" by `mongoose-zod` even if you uninstalled them. In you encounter such an issue, you need to clean your `package-lock.json` from optional peer dependencies definitions that you have uninstalled and then run `npm i`.

## Usage

Define the schema and use it as follows:

```ts
import {z} from 'zod';
import {genTimestampsSchema, toMongooseSchema, mongooseZodCustomType} from 'mongoose-zod';

export const userZodSchema = z
  .object({
    // Sub schema
    info: z.object({
      // Define type options like this (NOT recommended - better to use `typeOptions` passed to `.mongoose()` - see FAQ)
      nickname: z.string().min(1).mongooseTypeOptions({unique: true}),
      birthday: z.tuple([
        z.number().int().min(1900),
        z.number().int().min(1).max(12),
        z.number().int().min(1).max(31),
      ]),
      // Unlike mongoose, arrays won't have an empty array `[]` as a default value!
      friends: z.number().int().min(1).array().optional(),
      // Making the field optional
      status: z.enum(['😊', '😔', '🤔']).optional(),
      // Use this function to use special (Buffer, ObjectId, ...) and custom (Long, ...) types
      avatar: mongooseZodCustomType('Buffer'),
    }),
    // Default values set with zod's .default() are respected
    regDate: z.date().default(new Date()),
  })
  // Schema merging supported natively by zod. We make use of this feature
  // by providing a schema generator for creating type-safe timestamp fields
  .merge(genTimestampsSchema('crAt', 'upAt'))
  // Define schema options here:
  .mongoose({
    schemaOptions: {
      collection: 'users',

      // Full type safety in virtuals, as well as in statics, methods and query methods
      virtuals: {
        bday: {
          get() {
            const [y, m, d] = this.info.birthday;
            return new Date(y, m - 1, d);
          },
          set(d: Date) {
            this.info.birthday = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
          },
        },
      },

      statics: { ... },
      methods: { ... },
      query: { ... },
    },

    // Ability to override type schema options
    typeOptions: {
      upAt: {
        index: false,
      },
    },
  });

const UserSchema = toMongooseSchema(userZodSchema);

const User = M.model('User', UserSchema);

const user = new User().toJSON();
```

Result:

![User model instance type](./assets/model-instance-type.png)

## Additional safety measures

Since the overarching goal of this library is to simplify working with mongoose schemas, one way to accomplish that is to also get rid of non-obvious, too permissive or annoying behaviour of mongoose. That's why by default:

- Arrays **won't** have an empty array `[]` set as a default value (it is `undefined` instead, but you will be able to override it).
- Root schema **won't** have an `id` virtual.
- Empty objects **won't be removed** from documents upon saving ([`minimize`](https://mongoosejs.com/docs/guide.html#minimize) is set to `false`).
- Sub schemas (which are automatically created for fields with `ZodObject` type) **won't** be set an `_id` property.
- All array field **will not allow** casting of non-array values to arrays.
- Casting is also **disabled** for types like number, string, boolean and date and **cannot** be re-enabled (WARNING: doesn't currently work in array of objects).
- Schemas will have [`strict`](https://mongoosejs.com/docs/guide.html#strict) option set to `throw` instead of just `true` by default (throws if a document has extraneous fields).
- For all the fields of `Buffer` type an actual `Buffer` instance (and not mongodb's `Binary`) will be returned after using `.lean()` ([see here why it's not the case in mongoose](https://github.com/Automattic/mongoose/issues/7964#issuecomment-509698515)). This is achieved by defining a getter on such fields which pulls out a buffer from a `Binary`. Such getters can be overriden, and it is also exported under `bufferMongooseGetter` name.

But that's not all.

### Type-safe `validate` and `required` options

You can use special `validate` and `required` type options alternatives we provide, `mzValidate` and `mzRequired` respectively. In contrast to their vanilla counterparts, they not only guarantee type safety, but their runtime behaviour matches the declared types. They will actually have `this` set to `undefined` when run during update operation [(click here for mongoose docs on this)](https://mongoosejs.com/docs/validation.html#update-validators-and-this) and `mzValidate` will have a proper type of its argument.

⚠️ Some warnings:
- `this` type is still going to be `any` when used with `.mongooseTypeOptions`. See the FAQ for more info on the best way of defining type options in general.
- You can't define `validate` and `mzValidate` (and the other one) simultaneously. The error will be thrown upon schema creation if both say `required` and `mzRequired` are present.
- `Schema.validate()` calls that register additional validators **won't** be type safe.

### Certain plugins are automatically added to schemas if found

If the following plugins are installed, they will be automatically registered on every schema you create with mongoose-zod:
- [`mongoose-lean-virtuals`](https://github.com/vkarpov15/mongoose-lean-virtuals)
- [`mongoose-lean-defaults`](https://github.com/douglasgabr/mongoose-lean-defaults)
- [`mongoose-lean-getters`](https://github.com/vkarpov15/mongoose-lean-getters)

You can opt out of this behaviour when creating a schema in the following manner:

```ts
const Schema = toMongooseSchema( ... , {
  disablePlugins: {
    leanVirtuals: true,
    leanDefaults: true,
    leanGetters: true,
  },
});
```

The most intriguing thing is that you *won't have to explicitly make them work on every .lean() call*:

```ts
const user = await User.findOne({ ... }).lean();
// is equivalent to (if respective plugins are installed):
const user = await User.findOne({ ... }).lean({
  virtuals: true,
  defaults: true,
  getters: true,
  // Bonus: this is set regardless of plugins
  versionKey: false,
});
```

You can **override** certain options if you wish:

```ts
// If `mongoose-lean-getters` is installed, `getters: true` will still be implicitly set
const user = await User.findOne({ ... }).lean({ virtuals: false, anyOtherOption: true });
```

Notes:
* If you pass to `.lean()` anything but an object or `null`, these options won't be set.
* The described behaviour is achieved by defining a custom `lean` query method. If you also define a query method with `lean` name, it will override our version.


### More on schema's [`strict` option](https://mongoosejs.com/docs/guide.html#strict)

By default `mongooze-zod` sets `strict` option to `throw` instead of `true` for a root schema and sub schemas. You can control this behaviour by changing `unknownKeys` option when creating a schema:

- `unknownKeys: 'throw'` is an alias for the default behaviour.
- `unknownKeys: 'strip'` makes sure `throw` is **always** set to `true` and cannot be overriden via zod schemas.
- `unknownKeys: 'strip-unless-overridden'` allows to override this schema option with zod's [`.passthrough()`](https://zod.dev/?id=passthrough) and [`strip()`](https://zod.dev/?id=strip).
- You can **always override** `strict` option value by redefining it in the schema options.

## FAQ

### What is the recommended way of defining type options?

The example above demonstrates that there are two ways of defining type options for the field: using `.mongooseTypeOptions({ ... })` or `.mongoose({typeOptions: { ... }})`. There's a good reason why two options exist and here is the recipe for their correct usage:

- Use `.mongooseTypeOptions` in shared schemas you're planning to merge/extend/modify (because after you've used `.mongoose()` you won't be able to do any of these operations).
- Сonsequently, use `.mongoose` elsewhere. It's less verbose and this way you separate field type declarations from field metadata like indexes, custom validators, etc. Moreover, **only here type safety is fully available** for some custom type options we provide.
- Keep in mind that options defined in `.mongoose` override the ones defined in `.mongooseTypeOptions`.

### How to obtain a schema type and what to do with it?

You have two options:
- Infer *zod schema* type as follows: `type SchemaType = z.infer<typeof zodSchema>`.
- Infer *mongoose schema* type as follows: `type SchemaType = mongoose.InferSchemaType<typeof MongooseSchema>`.

The good thing is they both should be equal! Then you can use it say in your frontend code by using TypeScript's *[type only import](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html)* to make sure no actual code is imported, only types:

```ts
// user.model.ts (backend):
...
const userZodSchema = z.object({ ... }).mongoose();
const UserSchema = toMongooseSchema(userZodSchema);
...
export type IUser = z.infer<typeof userZodSchema>;
// OR
export type IUser = mongoose.InferSchemaType<typeof UserSchema>;
...

// somewhere on frontend, notice "import type":
import type {IUser} from '<...>/user.model';
...
```

### How to use special types like `Buffer`, `ObjectId`, `Decimal128` or custom ones like `Long`?

Use a *stand-alone* function called `mongooseZodCustomType`.

```ts
import {z} from 'zod';
import {mongooseZodCustomType} from 'mongoose-zod';

const zodSchema = z.object({
  refs: mongooseZodCustomType('ObjectId').array(),
  data: mongooseZodCustomType('Buffer').optional(),
}).mongoose();
```

### Don't we still have type safety for options like `alias` and `timestamps`?

Yes, we don't. Instead `timestamps`, merge your schema with a timestamps schema generator exported under the `genTimestampsSchema` name.

Instead `alias`, simply use a virtual (which is what mongoose aliases actually are).

### What zod types are supported and how are they mapped to mongoose types?

| zod type                                                              | mongoose type        |
| :-------------------------------------------------------------------- | :------------------- |
| `Number`, number *finite* literal, native numeric enum, numbers union | `MongooseZodNumber`  |
| `String`, `Enum`, string literal, native string enum, strings union   | `MongooseZodString`  |
| `Date`, dates union                                                   | `MongooseZodDate`    |
| `Boolean`, boolean literal, booleans union                            | `MongooseZodBoolean` |
| `Map`                                                                 | `Map`                |
| `NaN`, `NaN` literal                                                  | `Mixed`              |
| `Null`, `null` literal                                                | ^                    |
| Heterogeneous<sup>1</sup> `NativeEnum`                                | ^                    |
| `Unknown`                                                             | ^                    |
| `Record`                                                              | ^                    |
| `Union`                                                               | ^                    |
| `DiscriminatedUnion`<sup>2</sup>                                      | ^                    |
| `Intersection`                                                        | ^                    |
| `Type`                                                                | ^                    |
| `TypeAny`                                                             | ^                    |
| `Any`                                                                 | depends<sup>3</sup>  |
| `Array`                                                               | mongoose type corresponding to the unwrapped schema's type |
| Other types                                                           | not supported        |

<sup>1</sup> Enums with mixed values, e.g. with both string and numbers. Also see [TypeScript docs](https://www.typescriptlang.org/docs/handbook/enums.html#heterogeneous-enums).<br>
<sup>2</sup> Has nothing to do with mongoose discriminators.<br>
<sup>3</sup> A class provided with `mongooseZodCustomType()` or `Mixed` instead.

- Types named `MongooseZodBaseClass` are custom types inherited from `BaseClass` with the only function overloaded being `cast` which disables casting altogether.
- If the zod type is not supported, a `MongooseZodError` error will be thrown upon schema creation.
- The same error will be thrown when the zod type as a whole is supported, but this specific case it describes is not. Some examples: `Infinity` number literal, `bigint` literal, empty enums.

### How do I access the data set by `.mongooseTypeOptions/.mongoose`?

We expose `MongooseTypeOptionsSymbol` and `MongooseSchemaOptionsSymbol` symbols respectively that you can use to get to the data set with the respective methods in the following way:

```ts
const zodSchema = z.object({ ... }).mongoose({ ... });
const schemaOptions = zodSchema._def[MongooseSchemaOptionsSymbol];
```

## ⚠️ Caveats ⚠️

### I get the error: `.mongooseTypeOptions/.mongoose is not a function`

It is due to that `mongoose-zod` extends the prototype of `z` to chain the functions you are experiencing trouble with.
This error indicates that zod extensions this package adds have not been registered yet. This may happen when you've used either of these methods but haven't imported anything from `mongoose-zod`. In this case the best strategy would probably be to **import the package** at the entrypoint of your application like that:
```ts
import 'mongoose-zod';
...
```

You can also use the `z` that is included in `mongoose-zod` instead of the `z` from `zod` directly to be sure you have the correct `z` reference
```ts
import {z} from 'mongoose-zod';

...
const userZodSchema = z.object({ ... }).mongoose();
const UserSchema = toMongooseSchema(userZodSchema);
```

When this is not possible in your use case, or you prefer a function over a prototype extend you can use the following

```ts
import {addMongooseTypeOptions, toZodMongooseSchema} from './extensions';

const zodSchema = toZodMongooseSchema(z.object({
  nickname: addMongooseTypeOptions(z.string().min(1), {unique: true}),
  friends: z.number().int().min(1).array().optional(),
}))
```
instead of 
```ts
const zodSchema = z.object({
  nickname: z.string().min(1).mongooseTypeOptions({unique: true}),
  friends: z.number().int().min(1).array().optional(),
}).mongoose();
```

### Be careful when using shared schemas with `.mongooseTypeOptions/.mongoose`

If the schema of multiple fields is structurally the same, we highly recommend that you do NOT create a shared schema. Instead, create a factory, because the data attached with `.mongooseTypeOptions/.mongoose` will also be shared, and that's not always what you want.

```ts
// ❌ DON'T do:
const PositiveInt = z.number().int().min(1);
... // somewhere in the schema definition:
  userId: PositiveInt.mongooseTypeOptions({ index: true}),
  country: PositiveInt, // surprise, this field will have "index: true" as well!
...

// ✅ do:
const PositiveInt = () => z.number().int().min(1);
...
  userId: PositiveInt().mongooseTypeOptions({ index: true}),
  country: PositiveInt(),
...
```

### Prefer `ZodRecord` over `ZodMap`

We highly recommend that you do not use `ZodMap`. `Map` values are problematic to serialize and they're stored as [BSON](https://www.mongodb.com/json-and-bson) objects anyway, therefore now can be safely replaced with `ZodRecord`. *(Well, actually, prefer arrays over records, unless you really need them).*

### `ZodObject` as a member of union is not treated like a sub schema

It means that no default schema options will be set (because mongoose's sub schema won't be created in the first place) for a `ZodObject` in a `ZodUnion`. For example this results in unknown keys **are not being** removed. You must use zod's `.strict()`/`.passthrough()` methods to control this behaviour.

### Values in an array of objects still casted by mongoose

Unfortunately I haven't found a way yet to disable casting in this case. PR's and presenting your ideas on how to achieve that are more than welcome!

That's an illustration on what is meant here:

```ts
const Schema = toMongooseSchema(
  ...
  arrayOfObjects: z.object({a: z.string()}).array()
  ...
);
const Model = mongoose.model('model_name', Schema);
const doc = new Model({ ..., arrayOfObjects: [{a: ''}]}, ...);
// becomes :(
{ ..., arrayOfObjects: [{a: undefined}], ...}
```

## License

See LICENSE.md.