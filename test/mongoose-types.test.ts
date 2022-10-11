import {MongoMemoryServer} from 'mongodb-memory-server';
import M from 'mongoose';
import {z} from 'zod';
import {mongooseZodCustomType, toMongooseSchema} from '../src/index.js';

describe('Mongoose types', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await M.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoServer?.stop();
    await M.disconnect();
  });

  beforeEach(() => {
    Object.keys(M.connection.models).forEach((modelName) => {
      delete (M.connection.models as any)[modelName];
    });
  });

  it.each([
    {type: 'number', schema: z.number(), operator: '$mod', operand: [4, 2]},
    {
      type: 'Buffer',
      schema: mongooseZodCustomType('Buffer'),
      operator: '$lte',
      operand: Buffer.from('data'),
    },
    {type: 'string', schema: z.string(), operator: '$regex', operand: /^hello$/},
    {type: 'date', schema: z.date(), operator: '$gte', operand: 42},
    {
      type: 'ObjectId',
      schema: mongooseZodCustomType('ObjectId'),
      operator: '$lt',
      operand: new M.Types.ObjectId(),
    },
  ])(
    'Does not throw when using operators available for type $type',
    async ({schema, operator, operand}) => {
      const zodSchema = z.object({a: schema}).mongoose();

      const Schema = toMongooseSchema(zodSchema);
      const Model = M.model('test', Schema);

      let error: any;
      try {
        await Model.find({a: {[operator]: operand}});
      } catch (e) {
        error = e;
      }

      expect(error).toBe(undefined);
    },
  );

  it('Allows to work with Buffer type', async () => {
    const Model = M.model(
      'test',
      toMongooseSchema(z.object({data: mongooseZodCustomType('Buffer')}).mongoose()),
    );

    const docRaw = new Model();
    docRaw.data = Buffer.from('Hello world!');

    expect(docRaw.data).toBeInstanceOf(Buffer);

    await docRaw.save();
    const doc = await Model.findOne({_id: docRaw._id});

    expect(doc?.data).toBeInstanceOf(Buffer);
  });
});
