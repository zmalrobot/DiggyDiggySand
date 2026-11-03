// Compositing leggero per Post-Processing: Selective Bloom (emissivo atlantideo/oro),
// Color Grading caldo per la profondità del cratere e Vignette radiale cinematografica.
// Disattivabile da impostazioni per garantire 60 FPS su qualsiasi dispositivo.
import * as THREE from 'three';

const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBloomIntensity: { value: 0.55 },
    uBloomThreshold: { value: 0.68 },
    uVignetteDarkness: { value: 0.42 },
    uVignetteOffset: { value: 0.88 },
    uWarmth: { value: 0.12 },
    uEnabled: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uBloomIntensity;
    uniform float uBloomThreshold;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uWarmth;
    uniform float uEnabled;
    varying vec2 vUv;

    // Luminanza pesata secondo lo standard percettivo sRGB
    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uEnabled < 0.5) {
        gl_FragColor = base;
        return;
      }

      // 1. Selective Bloom (campioni radiali multi-tap per materiali emissivi/oricalco)
      vec2 texel = 1.0 / uResolution;
      vec3 bloomAcc = vec3(0.0);
      float totalWeight = 0.0;

      // Kernel di campionamento selettivo a raggio esteso
      vec2 offsets[8];
      offsets[0] = vec2(-2.0, -2.0);
      offsets[1] = vec2( 2.0, -2.0);
      offsets[2] = vec2(-2.0,  2.0);
      offsets[3] = vec2( 2.0,  2.0);
      offsets[4] = vec2(-3.5,  0.0);
      offsets[5] = vec2( 3.5,  0.0);
      offsets[6] = vec2( 0.0, -3.5);
      offsets[7] = vec2( 0.0,  3.5);

      for (int i = 0; i < 8; i++) {
        vec3 sampleColor = texture2D(tDiffuse, vUv + offsets[i] * texel * 1.6).rgb;
        float luma = getLuma(sampleColor);
        // Estrai solo le zone luminose/emissive (cristalli ciano, riflessi oro, monete)
        float glowFactor = max(0.0, luma - uBloomThreshold);
        bloomAcc += sampleColor * glowFactor;
        totalWeight += 1.0;
      }
      vec3 bloom = (bloomAcc / totalWeight) * uBloomIntensity;

      // 2. Color Grading: riscalda le ombre sabbiose ed enfatizza i toni ciano/oricalco
      vec3 graded = base.rgb + bloom;
      // Iniezione di gradiente caldo nei mezzitoni
      graded.r += uWarmth * (1.0 - graded.r) * graded.r;
      graded.g += uWarmth * 0.45 * (1.0 - graded.g) * graded.g;

      // Leggero contrasto s-curve morbido
      graded = smoothstep(0.0, 1.05, graded);

      // 3. Vignette radiale cinematografica per focalizzare lo scavo al centro
      vec2 centerCoord = vUv - vec2(0.5);
      float dist = length(centerCoord);
      float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.48, dist);
      vec3 finalColor = mix(graded * (1.0 - uVignetteDarkness), graded, vignette);

      gl_FragColor = vec4(finalColor, base.a);
    }
  `
};

export class PostProcessing {
  constructor(renderer, scene, camera, settings = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;

    this.enabled = this.settings ? this.settings.get('graphics.postProcessing') !== false : true;

    // Crea WebGLRenderTarget con campionamento lineare e profondità
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const pixelRatio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(size.x * pixelRatio));
    const h = Math.max(1, Math.floor(size.y * pixelRatio));

    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: true,
    });

    // Scena ortografica per il quad a schermo intero
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: PostShader.vertexShader,
      fragmentShader: PostShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(PostShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });
    this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.postMaterial.uniforms.uResolution.value.set(w, h);
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.postQuad = new THREE.Mesh(quadGeo, this.postMaterial);
    this.postScene = new THREE.Scene();
    this.postScene.add(this.postQuad);

    this._unsub = this.settings?.subscribe?.('graphics.postProcessing', (val) => {
      this.setEnabled(!!val);
    });
  }

  setEnabled(val) {
    this.enabled = !!val;
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;
  }

  setSize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.renderTarget.setSize(w, h);
    this.postMaterial.uniforms.uResolution.value.set(w, h);
  }

  /**
   * Esegue il rendering con post-processing o passa direttamente a renderer.render
   * se disattivato, garantendo zero overhead prestazionale su hardware datato.
   */
  render() {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 1. Render della scena 3D principale nel buffer texture
    const currentTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 2. Compositing a schermo intero (bloom + vignette + color grading)
    this.renderer.setRenderTarget(currentTarget);
    this.renderer.render(this.postScene, this.postCamera);
  }

  dispose() {
    this._unsub?.();
    this.renderTarget?.dispose();
    this.postMaterial?.dispose();
    this.postQuad?.geometry?.dispose();
  }
}

