/* eslint-disable global-require */
import {MongoMemoryServer} from 'mongodb-memory-server';
import M from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';
import {tryImportModule} from '../src/utils.js';

const getSchemaPlugins = (schema: M.Schema) => (schema as any).plugins.map(({fn}) => fn);
const importModule = (id: string) => tryImportModule(id, import.meta)?.module;

describe('Plugins', () => {
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

  describe('mongoose-lean-virtuals', () => {
    it('Automatically adds `mongoose-lean-virtuals` plugin if installed', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose());

      expect(getSchemaPlugins(Schema)).toContain(importModule('mongoose-lean-virtuals'));
    });

    it('Does not add `mongoose-lean-virtuals` plugin if asked not to', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose(), {
        disablePlugins: {leanVirtuals: true},
      });

      expect(getSchemaPlugins(Schema)).not.toContain(importModule('mongoose-lean-virtuals'));
    });

    it('`mongoose-lean-virtuals` plugin works', async () => {
      const User = M.model(
        'User',
        toMongooseSchema(
          z.object({username: z.string()}).mongoose({
            schemaOptions: {
              virtuals: {
                u: {
                  get() {
                    return this.username;
                  },
                },
              },
            },
          }),
        ),
      );

      const TEST_USERNAME = 'mongoose-zod';

      await new User({username: TEST_USERNAME}).save();
      const user = await User.findOne({username: TEST_USERNAME}).lean({virtuals: true});

      expect(user?.username).toBe(TEST_USERNAME);
      expect(user?.u).toEqual(user?.username);
    });
  });

  describe('mongoose-lean-defaults', () => {
    it('Automatically adds `mongoose-lean-defaults` plugin if installed', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose());

      expect(getSchemaPlugins(Schema)).toContain(importModule('mongoose-lean-defaults').default);
    });

    it('Does not add `mongoose-lean-defaults` plugin if asked not to', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose(), {
        disablePlugins: {leanDefaults: true},
      });

      expect(getSchemaPlugins(Schema)).not.toContain(importModule('mongoose-lean-defaults'));
    });

    it('`mongoose-lean-defaults` plugin works', async () => {
      const User = M.model(
        'User',
        toMongooseSchema(
          z
            .object({username: z.string(), registered: z.boolean().optional().default(false)})
            .mongoose({}),
        ),
      );

      const TEST_USERNAME = 'mongoose-zod';

      await new User({username: TEST_USERNAME}).save();
      const user = await User.findOne({username: TEST_USERNAME}).lean({defaults: true});

      expect(user?.username).toBe(TEST_USERNAME);
      expect(user?.registered).toEqual(false);
    });
  });

  describe('mongoose-lean-getters', () => {
    it('Automatically adds `mongoose-lean-getters` plugin if installed', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose());

      expect(getSchemaPlugins(Schema)).toContain(importModule('mongoose-lean-getters'));
    });

    it('Does not add `mongoose-lean-getters` plugin if asked not to', () => {
      const Schema = toMongooseSchema(z.object({}).mongoose(), {
        disablePlugins: {leanGetters: true},
      });

      expect(getSchemaPlugins(Schema)).not.toContain(importModule('mongoose-lean-getters'));
    });

    it('`mongoose-lean-getters` plugin works', async () => {
      const User = M.model(
        'User',
        toMongooseSchema(
          z.object({username: z.string()}).mongoose({
            typeOptions: {
              username: {
                get(value) {
                  return value.toUpperCase();
                },
              },
            },
          }),
        ),
      );

      const TEST_USERNAME = 'mongoose-zod';

      await new User({username: TEST_USERNAME}).save();
      const user = await User.findOne({username: TEST_USERNAME}).lean({getters: true});

      expect(user?.username).toBe(TEST_USERNAME.toUpperCase());
    });
  });
});
