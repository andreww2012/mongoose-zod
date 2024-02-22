import type M from 'mongoose';
import {tryImportModule} from '../src/utils.js';

export const getSchemaPlugins = (schema: M.Schema) =>
  (schema as any).plugins.map(({fn}: any) => fn);
export const importModule = (id: string) => tryImportModule(id, import.meta)?.module;
