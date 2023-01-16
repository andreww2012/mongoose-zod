import M from 'mongoose';
import {MongooseZodError, genTimestampsSchema, toMongooseSchema} from '../src/index.js';

describe('Generate timestamps schema helper', () => {
  beforeEach(() => {
    Object.keys(M.connection.models).forEach((modelName) => {
      delete (M.connection.models as any)[modelName];
    });
  });

  it('Generates a schema with `createdAt` and `updatedAt` fields by default and with the correct type and schema options', () => {
    const Schema = toMongooseSchema(genTimestampsSchema().mongoose());

    expect(Schema.paths.createdAt?.options).toMatchObject({
      required: true,
      index: true,
      immutable: true,
    });

    expect(Schema.paths.updatedAt?.options).toMatchObject({
      required: true,
      index: true,
    });
    expect(Schema.paths.updatedAt?.options.immutable).not.toBe(true);

    expect((Schema as any).options.timestamps).toEqual({
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    });
  });

  it('Generates a schema only with `createdAt` field if argument for `updatedAt` set to null', () => {
    const Schema = toMongooseSchema(genTimestampsSchema('createdAt', null).mongoose());

    expect(Schema.paths.createdAt?.options).toMatchObject({
      required: true,
      index: true,
      immutable: true,
    });

    expect(Schema.paths.updatedAt).toBeUndefined();

    expect((Schema as any).options.timestamps).toEqual({
      createdAt: 'createdAt',
      updatedAt: false,
    });
  });

  it('Generates a schema only with `updatedAt` field if argument for `createdAt` set to null', () => {
    const Schema = toMongooseSchema(genTimestampsSchema(null, 'updatedAt').mongoose());

    expect(Schema.paths.createdAt).toBeUndefined();

    expect(Schema.paths.updatedAt?.options).toMatchObject({
      required: true,
      index: true,
    });
    expect(Schema.paths.updatedAt?.options.immutable).not.toBe(true);

    expect((Schema as any).options.timestamps).toEqual({
      createdAt: false,
      updatedAt: 'updatedAt',
    });
  });

  it('Does not include `createdAt`/`updatedAt` fields if both arguments are set to null', () => {
    const Schema = toMongooseSchema(genTimestampsSchema(null, null).mongoose());

    expect(Schema.paths.createdAt).toBeUndefined();
    expect(Schema.paths.updatedAt).toBeUndefined();

    expect((Schema as any).options.timestamps).toEqual({
      createdAt: false,
      updatedAt: false,
    });
  });

  it('Sets provided custom names for `createdAt`/`updatedAt` fields', () => {
    const Schema = toMongooseSchema(genTimestampsSchema('cd', 'ud').mongoose());

    expect(Schema.paths.createdAt).toBeUndefined();
    expect(Schema.paths.cd?.options).toMatchObject({
      required: true,
      index: true,
      immutable: true,
    });

    expect(Schema.paths.updatedAt).toBeUndefined();
    expect(Schema.paths.ud?.options).toMatchObject({
      required: true,
      index: true,
    });
    expect(Schema.paths.ud?.options.immutable).not.toBe(true);

    expect((Schema as any).options.timestamps).toEqual({
      createdAt: 'cd',
      updatedAt: 'ud',
    });
  });

  it('`createdAt` and `updatedAt` works as indended', () => {
    const Schema = toMongooseSchema(genTimestampsSchema().mongoose());

    const Model = M.model('model', Schema);

    const doc = new Model();

    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
    expect(doc.createdAt).toEqual(doc.updatedAt);
  });

  it('`createdAt` and `updatedAt` works as indended (custom names)', () => {
    const Schema = toMongooseSchema(genTimestampsSchema('cd', 'ud').mongoose());

    const Model = M.model('model', Schema);

    const doc = new Model();

    expect(doc.cd).toBeInstanceOf(Date);
    expect(doc.ud).toBeInstanceOf(Date);
    expect(doc.cd).toEqual(doc.ud);
    expect((doc as any).createdAt).toBeUndefined();
    expect((doc as any).uptdatedAt).toBeUndefined();
  });

  it('Allows to override schema options implicitly set by this helper', () => {
    const OUR_SCHEMA_OPTIONS = {
      collection: 'test',
      timestamps: false,
    };
    const Schema = toMongooseSchema(
      genTimestampsSchema().mongoose({
        schemaOptions: {
          ...OUR_SCHEMA_OPTIONS,
        },
      }),
    );

    expect((Schema as any).options).toMatchObject(OUR_SCHEMA_OPTIONS);
  });

  it('Throws when the same name supplied both for `createdAt` and `updatedAt`', () => {
    let error: any;
    try {
      genTimestampsSchema('createdAt', 'createdAt');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MongooseZodError);
    expect(error?.message).toEqual('`createdAt` and `updatedAt` fields must be different');
  });
});
