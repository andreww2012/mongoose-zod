/* eslint-disable unicorn/no-this-assignment, @typescript-eslint/no-this-alias */
import {MongoMemoryServer} from 'mongodb-memory-server';
import M from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';

describe('Type options provided by mongoose-zod', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await M.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoServer.stop();
    await M.disconnect();
  });

  beforeEach(() => {
    Object.keys(M.connection.models).forEach((modelName) => {
      delete (M.connection.models as any)[modelName];
    });
  });

  describe('mzValidate', () => {
    it('Calls validators if a validation function passed to `mzValidate`', () => {
      const validate = jest.fn();
      const zodSchema = z.object({username: z.string()}).mongoose({
        typeOptions: {
          username: {
            mzValidate: validate,
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      new Model({username: 'something'}).validateSync();

      expect(validate).toHaveBeenCalled();
    });

    it('Calls validators if a validation function passed to `mzValidate` on a sub schema', () => {
      const validate = jest.fn();
      const zodSchema = z
        .object({
          user: z.object({username: z.string()}).mongoose({
            typeOptions: {
              username: {
                mzValidate: validate,
              },
            },
          }),
        })
        .mongoose();

      const Model = M.model('test', toMongooseSchema(zodSchema));
      new Model({user: {username: 'something'}}).validateSync();

      expect(validate).toHaveBeenCalled();
    });

    it('Calls validators if an object with a validation function passed to `mzValidate`', () => {
      const validate = jest.fn();
      const zodSchema = z.object({username: z.string()}).mongoose({
        typeOptions: {
          username: {
            mzValidate: {
              message: 'any',
              validator: validate,
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      new Model({username: 'something'}).validateSync();

      expect(validate).toHaveBeenCalled();
    });

    it('Custom validation function has access to `this` in normal conditions', () => {
      let that: any;
      const zodSchema = z.object({username: z.string()}).mongoose({
        typeOptions: {
          username: {
            mzValidate() {
              that = this;
              return true;
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      const doc = new Model({username: 'something'});
      doc.validateSync();

      expect(that).toEqual(doc);
    });

    it('Custom validation function passed to the validation properties object has access to `this` in normal conditions', () => {
      let that: any;
      const zodSchema = z.object({username: z.string()}).mongoose({
        typeOptions: {
          username: {
            mzValidate: {
              validator() {
                that = this;
                return true;
              },
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      const doc = new Model({username: 'something'});
      doc.validateSync();

      expect(that).toEqual(doc);
    });

    it('Custom validation function has `this` set to undefined when validating in update operation', async () => {
      let that: any = null;
      const zodSchema = z.object({username: z.string()}).mongoose({
        typeOptions: {
          username: {
            mzValidate() {
              that = this;
              return true;
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));

      await Model.updateOne(
        {},
        {username: 'any'},
        {
          upsert: true,
          runValidators: true,
        },
      );

      expect(that).toEqual(undefined);
    });

    it('Custom validation function passed to the validation properties object has `this` set to undefined when validating in update operation', async () => {
      let that: any = null;
      const zodSchema = z.object({username: z.string().optional()}).mongoose({
        typeOptions: {
          username: {
            mzValidate: {
              validator() {
                that = this;
                return true;
              },
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));

      await Model.updateOne(
        {},
        {username: 'any'},
        {
          upsert: true,
          runValidators: true,
        },
      );

      expect(that).toEqual(undefined);
    });

    it('`mzValidate` validation works', () => {
      const zodSchema = z
        .object({
          email: z.string().email().optional(),
          registered: z.boolean().default(false),
        })
        .mongoose({
          typeOptions: {
            email: {
              mzValidate(value) {
                return !this || (Boolean(this.registered) && value.endsWith('gmail.com'));
              },
            },
          },
        });

      const Model = M.model('test', toMongooseSchema(zodSchema));

      expect(new Model({}).validateSync()).not.toBeInstanceOf(M.Error.ValidationError);
      expect(new Model({email: 'test@gmail.com'}).validateSync()).toBeInstanceOf(
        M.Error.ValidationError,
      );
      expect(new Model({email: 'test@test.com', registered: true}).validateSync()).toBeInstanceOf(
        M.Error.ValidationError,
      );
      expect(
        new Model({email: 'test@gmail.com', registered: true}).validateSync(),
      ).not.toBeInstanceOf(M.Error.ValidationError);
    });
  });

  describe('mzRequired', () => {
    it('Calls a function passed to `mzRequired`', () => {
      const required = jest.fn();
      const zodSchema = z.object({username: z.string().optional()}).mongoose({
        typeOptions: {
          username: {
            mzRequired: required,
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      new Model({username: 'something'}).validateSync();

      expect(required).toHaveBeenCalled();
    });

    it('`mzRequired` has access to `this` in normal conditions', () => {
      let that: any;
      const zodSchema = z.object({username: z.string().optional()}).mongoose({
        typeOptions: {
          username: {
            mzRequired() {
              that = this;
              return true;
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));
      const doc = new Model({username: 'something'});
      doc.validateSync();

      expect(that).toEqual(doc);
    });

    it('`mzRequired` has `this` set to undefined when validating in update operation', async () => {
      let that: any = null;
      const zodSchema = z.object({username: z.string().optional()}).mongoose({
        typeOptions: {
          username: {
            mzRequired() {
              that = this;
              return true;
            },
          },
        },
      });

      const Model = M.model('test', toMongooseSchema(zodSchema));

      await Model.updateOne(
        {},
        {username: 'any'},
        {
          upsert: true,
          runValidators: true,
        },
      );

      expect(that).toEqual(undefined);
    });

    it('`mzRequired` validator works', () => {
      const zodSchema = z
        .object({
          username: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        })
        .mongoose({
          typeOptions: {
            lastName: {
              mzRequired() {
                return this ? Boolean(this.firstName) : false;
              },
            },
          },
        });

      const Model = M.model('test', toMongooseSchema(zodSchema));

      expect(new Model({username: 'any'}).validateSync()).not.toBeInstanceOf(
        M.Error.ValidationError,
      );
      expect(new Model({username: 'any', firstName: 'fn'}).validateSync()).toBeInstanceOf(
        M.Error.ValidationError,
      );
      expect(
        new Model({username: 'any', firstName: 'fn', lastName: 'ln'}).validateSync(),
      ).not.toBeInstanceOf(M.Error.ValidationError);
    });
  });
});
