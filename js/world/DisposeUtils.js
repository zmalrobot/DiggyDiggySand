// Utility avanzata per rilascio profondo delle risorse Three.js / WebGL:
// Geometrie, materiali, texture multiple (normalMap, roughnessMap, depthTexture),
// render targets e liste di rendering per prevenire leak di memoria GPU / VRAM.

export function deepDispose(obj) {
  if (!obj) return;

  obj.traverse((child) => {
    // 1. Rilascio geometrie
    if (child.geometry) {
      try {
        child.geometry.dispose?.();
      } catch {}
    }

    // 2. Rilascio materiali e relative mappe/texture
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;

        // Tutte le possibili texture Three.js agganciate al materiale
        const textureProps = [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'aoMap',
          'displacementMap',
          'alphaMap',
          'emissiveMap',
          'envMap',
          'lightMap',
          'specularMap',
          'depthTexture',
        ];

        for (const prop of textureProps) {
          const tex = m[prop];
          if (tex && typeof tex.dispose === 'function') {
            try {
              tex.dispose();
            } catch {}
          }
        }

        try {
          m.dispose?.();
        } catch {}
      }
    }

    // 3. Rilascio scheletro per mesh animate
    if (child.skeleton) {
      try {
        child.skeleton.dispose?.();
      } catch {}
    }
  });

  if (obj.parent) {
    obj.parent.remove(obj);
  }
}

export function disposeRenderTarget(rt) {
  if (!rt) return;
  try {
    if (rt.texture && typeof rt.texture.dispose === 'function') {
      rt.texture.dispose();
    }
    if (rt.depthTexture && typeof rt.depthTexture.dispose === 'function') {
      rt.depthTexture.dispose();
    }
    rt.dispose?.();
  } catch {}
}

