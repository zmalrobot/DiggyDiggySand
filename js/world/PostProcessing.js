// Compositing leggero per Post-Processing: Selective Bloom (emissivo atlantideo/oro),
// Color Grading caldo per la profondità del cratere, Vignette radiale e FXAA Antialiasing.
// Disattivabile da impostazioni per garantire 60 FPS su qualsiasi dispositivo.
import * as THREE from 'three';

const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBloomIntensity: { value: 0.4 },
    uBloomThreshold: { value: 0.85 },
    uBloomRadius: { value: 0.5 },
    uVignetteDarkness: { value: 0.28 },
    uVignetteOffset: { value: 0.95 },
    uWarmth: { value: 0.08 },
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
    uniform float uBloomRadius;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uWarmth;
    uniform float uEnabled;
    varying vec2 vUv;

    // Luminanza pesata secondo lo standard percettivo sRGB
    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    // Fast Approximate Anti-Aliasing (FXAA) per ripulire i bordi geometrici low-poly
    vec3 applyFXAA(sampler2D tex, vec2 uv, vec2 res) {
      vec2 inverseVP = 1.0 / res;
      vec3 rgbNW = texture2D(tex, uv + vec2(-1.0, -1.0) * inverseVP).rgb;
      vec3 rgbNE = texture2D(tex, uv + vec2(1.0, -1.0) * inverseVP).rgb;
      vec3 rgbSW = texture2D(tex, uv + vec2(-1.0, 1.0) * inverseVP).rgb;
      vec3 rgbSE = texture2D(tex, uv + vec2(1.0, 1.0) * inverseVP).rgb;
      vec3 rgbM  = texture2D(tex, uv).rgb;

      vec3 lumaVec = vec3(0.299, 0.587, 0.114);
      float lumaNW = dot(rgbNW, lumaVec);
      float lumaNE = dot(rgbNE, lumaVec);
      float lumaSW = dot(rgbSW, lumaVec);
      float lumaSE = dot(rgbSE, lumaVec);
      float lumaM  = dot(rgbM,  lumaVec);

      float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
      float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

      vec2 dir;
      dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
      dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * 0.125), 0.0078125);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = min(vec2(8.0, 8.0), max(vec2(-8.0, -8.0), dir * rcpDirMin)) * inverseVP;

      vec3 rgbA = 0.5 * (
        texture2D(tex, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
        texture2D(tex, uv + dir * (2.0 / 3.0 - 0.5)).rgb
      );
      vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(tex, uv + dir * -0.5).rgb +
        texture2D(tex, uv + dir * 0.5).rgb
      );
      float lumaB = dot(rgbB, lumaVec);
      if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
        return rgbA;
      }
      return rgbB;
    }

    void main() {
      if (uEnabled < 0.5) {
        gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
        return;
      }

      // 1. Antialiasing FXAA sul campione primario della scena
      vec3 base = applyFXAA(tDiffuse, vUv, uResolution);

      // 2. Selective Bloom calibrato (campioni radiali a raggio controllato)
      vec2 texel = (1.0 / uResolution) * max(0.2, uBloomRadius * 2.0);
      vec3 bloomAcc = vec3(0.0);
      float totalWeight = 0.0;

      // Kernel di campionamento a raggio controllato
      vec2 offsets[8];
      offsets[0] = vec2(-1.5, -1.5);
      offsets[1] = vec2( 1.5, -1.5);
      offsets[2] = vec2(-1.5,  1.5);
      offsets[3] = vec2( 1.5,  1.5);
      offsets[4] = vec2(-2.5,  0.0);
      offsets[5] = vec2( 2.5,  0.0);
      offsets[6] = vec2( 0.0, -2.5);
      offsets[7] = vec2( 0.0,  2.5);

      for (int i = 0; i < 8; i++) {
        vec3 sampleColor = texture2D(tDiffuse, vUv + offsets[i] * texel).rgb;
        float luma = getLuma(sampleColor);
        // Estrai solo le zone ad alta emissività senza scurire l'ambiente
        float glowFactor = max(0.0, luma - uBloomThreshold);
        bloomAcc += sampleColor * glowFactor;
        totalWeight += 1.0;
      }
      vec3 bloom = (bloomAcc / totalWeight) * uBloomIntensity;

      // 3. Color Grading: lieve riscaldamento senza distruggere i livelli di nero
      vec3 graded = base + bloom;
      graded.r += uWarmth * (1.0 - graded.r) * graded.r;
      graded.g += uWarmth * 0.4 * (1.0 - graded.g) * graded.g;

      // 4. Vignette morbida periferica per incorniciare lo scavo
      vec2 centerCoord = vUv - vec2(0.5);
      float dist = length(centerCoord);
      float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.45, dist);
      vec3 finalColor = mix(graded * (1.0 - uVignetteDarkness), graded, vignette);

      // Uscita sempre a piena opacità per evitare schermate nere/trasparenti su canvas
      gl_FragColor = vec4(finalColor, 1.0);
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

    // Crea WebGLRenderTarget con campionamento lineare, profondità e MSAA 4x su WebGL2
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
      samples: 4, // Hardware MSAA su WebGL2 per eliminare le scalettature
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

    // 2. Compositing a schermo intero (bloom + vignette + color grading + antialiasing)
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
