// Source: https://github.com/colinhacks/zod/blob/474d8f610a331b44a64f82f3d77e3d2d0ad6011a/src/helpers/util.ts#L29
export const getValidEnumValues = (obj: any) => {
  const validKeys = Object.keys(obj).filter((k) => typeof obj[obj[k]] !== 'number');
  const filtered: any = {};
  for (const k of validKeys) {
    filtered[k] = obj[k];
  }
  return Object.values(filtered);
};
