// Minimal reader for male_body.glb: one mesh, one primitive, tightly packed accessors (true for this file).

/** @param {ArrayBuffer} buf @returns {{ P0: Float32Array, N0: Float32Array, idx: Uint16Array | Uint32Array }} positions, normals, triangle indices */
export function parseGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
  const prim = json.meshes[0].primitives[0];
  const read = (ai, Type, comps) => {               // tightly packed accessors only (true for this file)
    const a = json.accessors[ai], bv = json.bufferViews[a.bufferView];
    return new Type(buf.slice(bin + (bv.byteOffset || 0) + (a.byteOffset || 0), bin + (bv.byteOffset || 0) + (a.byteOffset || 0) + a.count * comps * Type.BYTES_PER_ELEMENT));
  };
  const P0 = read(prim.attributes.POSITION, Float32Array, 3), N0 = read(prim.attributes.NORMAL, Float32Array, 3);
  const ia = json.accessors[prim.indices], idx = read(prim.indices, ia.componentType === 5125 ? Uint32Array : Uint16Array, 1);
  return { P0, N0, idx };
}
