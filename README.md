# mongoose-zod

A library which allows to author [mongoose](https://github.com/Automattic/mongoose) ("a MongoDB object modeling tool") schemas using [zod](https://github.com/colinhacks/zod) ("a TypeScript-first schema declaration and validation library").

## Purpose

Declaring mongoose schemas in TypeScript environment has always been tricky in terms of getting the most out of type safety:
* You either have to first declare an interface representing a document in MongoDB and then create a schema corresponding to that interface (you get no type safety at all - even the offical mongoose documentation says that "you as the developer are responsible for ensuring that your document interface lines up with your Mongoose schema")
* Or reverse things by using `mongoose.InferSchemaType<typeof schema>` which is far from ideal (impossible to narrow types, doesn't support TS enums, doesn't know about virtuals, has problems with fields named `type`, ...)
* Finally, you can use [typegoose](https://github.com/typegoose/typegoose) which is based on legacy decorators proposal and generally poorly infers types.

This library aims to solve many of the aforementioned problems utilizing `zod` as a schema authoring tool.

## Usage

⚠️ Please **do not forget** to read the [caveats](#caveats) section when you're done with the main documentation.

Install the package from [npm](https://www.npmjs.com/package/mongoose-zod):

```shell
npm i mongoose-zod
```

⚠️ You also need to install peer dependencies being `zod` and `mongoose`:

```shell
npm i mongoose zod
```

Then, define a schema and use it as follows:

```ts
import {z} from 'zod';
import {genTimestampsSchema, toMongooseSchema, zodMongooseCustomType} from 'mongoose-zod';

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
      avatar: zodMongooseCustomType('Buffer'),
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
- Casting is also **disabled** for types like number, string, boolean and date and **cannot** be re-enabled.

But that's not all.

### Type-safe `validate` and `required` options

You can use special `validate` and `required` type options alternatives we provide, `mzValidate` and `mzRequired` respectively. In contrast to their vanilla counterparts, they not only guarantee type safety, but their runtime behaviour matches the declared types. They will actually have `this` set to `undefined` when run during update operation [(click here for mongoose docs on this)](https://mongoosejs.com/docs/validation.html#update-validators-and-this) and `mzValidate` will have a proper type of its argument.

⚠️ Some warnings:
- `this` type is still going to be `any` when used with `.mongooseTypeOptions`. See the FAQ for more info on the best way of defining type options in general.
- You can't define `validate` and `mzValidate` (and the other one) simultaneously. The error will be thrown upon schema creation if both say `required` and `mzRequired` are present.
- `Schema.validate()` calls that register additional validators **won't** be type safe.

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

Use a *stand-alone* function called `zodMongooseCustomType`.

```ts
import {z} from 'zod';
import {zodMongooseCustomType} from 'mongoose-zod';

const zodSchema = z.object({
  refs: zodMongooseCustomType('ObjectId').array(),
  data: zodMongooseCustomType('Buffer').optional(),
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
| Other types                                                           | not supported        |

<sup>1</sup> Enums with mixed values, e.g. with both string and numbers. Also see [TypeScript docs](https://www.typescriptlang.org/docs/handbook/enums.html#heterogeneous-enums).<br>
<sup>2</sup> Has nothing to do with mongoose discriminators.<br>
<sup>3</sup> A class provided with `zodMongooseCustomType()` or `Mixed` instead.

- Types named `MongooseZodBaseClass` are custom types inherited from `BaseClass` with the only function overloaded being `cast` which disables casting altogether.
- If the zod type is not supported, a `MongooseZodError` error will be thrown upon schema creation.
- The same error will be thrown when when the zod type as a whole is supported, but this specific case it describes is not. Some examples: `Infinity` number literal, `bigint` literal, empty enums.

## ⚠️ Caveats

### I get the error: `.mongooseTypeOptions/.mongoose is not a function`

This error indicates that zod extensions this package adds have not been registered yet. This may happen when you've used either of these methods but haven't imported anything from `mongoose-zod`. In this case the best strategy would probably be to **import the package** at the entrypoint of your application like that:

```ts
import 'mongoose-zod';
...
```

### TS error: can't assign a Buffer to a field having `Buffer` type

That's because this field would have `mongoose.Types.Buffer` type which extends the native `Buffer`. Just use `as mongoose.Types.Buffer` after the expression you assign to such a field.

## License

See LICENSE.md.