import M from 'mongoose';
import {z} from 'zod';
import {toMongooseSchema} from '../src/index.js';

describe('Schema virtuals', () => {
  beforeEach(() => {
    Object.keys(M.connection.models).forEach((modelName) => {
      delete (M.connection.models as any)[modelName];
    });
  });

  const SCHEMA_WITH_VIRTUALS = z
    .object({
      firstName: z.string(),
      lastName: z.string(),
    })
    .mongoose({
      schemaOptions: {
        virtuals: {
          fullName: {
            get() {
              return `${this.firstName} ${this.lastName}`;
            },
            set(fullName: string) {
              const [fn, ln] = fullName.trim().split(' ');
              this.firstName = fn;
              this.lastName = ln;
            },
          },
        },
      },
    });

  it('Registeres the virtuals declared in root schema options', () => {
    const zodSchema = SCHEMA_WITH_VIRTUALS;

    const Model = M.model('test', toMongooseSchema(zodSchema));
    const instance = new Model({firstName: 'A', lastName: 'B'});

    expect(instance.fullName).toEqual(`A B`);

    instance.fullName = 'C D';

    expect(instance.firstName).toEqual('C');
    expect(instance.lastName).toEqual('D');
  });

  it('Registeres the virtuals declared in sub schema options', () => {
    const zodSchema = z.object({name: SCHEMA_WITH_VIRTUALS}).mongoose();

    const Model = M.model('test', toMongooseSchema(zodSchema));
    const instance = new Model({name: {firstName: 'A', lastName: 'B'}});

    expect(instance.name.fullName).toEqual(`A B`);

    instance.name.fullName = 'C D';

    expect(instance.name.firstName).toEqual('C');
    expect(instance.name.lastName).toEqual('D');
  });
});
