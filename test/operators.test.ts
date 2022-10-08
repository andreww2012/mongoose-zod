import {MongoMemoryServer} from 'mongodb-memory-server';
import M from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema, zodMongooseCustomType} from '../src/index.js';

describe('Using MongoDB operators', () => {
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
      schema: zodMongooseCustomType('Buffer'),
      operator: '$lte',
      operand: Buffer.from('data'),
    },
    {type: 'string', schema: z.string(), operator: '$regex', operand: /^hello$/},
    {type: 'date', schema: z.date(), operator: '$gte', operand: 42},
    {
      type: 'ObjectId',
      schema: zodMongooseCustomType('ObjectId'),
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
});
