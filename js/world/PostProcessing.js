// Compositing per Post-Processing: Selective Bloom (emissivo atlantideo/oro),
// Color Grading caldo, Vignette radiale, FXAA Antialiasing e Simulazione Raytracing
// Screen-Space Reflections (SSR) & Screen-Space Ambient Occlusion (SSAO).
// Disattivato di default per garantire zero-overhead prestazionale su qualsiasi dispositivo.
import * as THREE from 'three';

const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.5 },
    cameraFar: { value: 400.0 },
    cameraProjectionMatrix: { value: new THREE.Matrix4() },
    cameraInverseProjectionMatrix: { value: new THREE.Matrix4() },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBloomIntensity: { value: 0.4 },
    uBloomThreshold: { value: 0.85 },
    uBloomRadius: { value: 0.5 },
    uVignetteDarkness: { value: 0.28 },
    uVignetteOffset: { value: 0.95 },
    uWarmth: { value: 0.08 },
    uEnabled: { value: 1.0 },
    uRaytracingSSR: { value: 0.0 },
    uSSRIntensity: { value: 0.65 },
    uSSAOIntensity: { value: 0.4 },
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
    uniform sampler2D tDepth;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform mat4 cameraProjectionMatrix;
    uniform mat4 cameraInverseProjectionMatrix;
    uniform vec2 uResolution;
    uniform float uBloomIntensity;
    uniform float uBloomThreshold;
    uniform float uBloomRadius;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uWarmth;
    uniform float uEnabled;
    uniform float uRaytracingSSR;
    uniform float uSSRIntensity;
    uniform float uSSAOIntensity;
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

    // Ricostruzione coordinate 3D View Space partendo da coordinate schermo UV e depth
    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewPos = cameraInverseProjectionMatrix * clip;
      return viewPos.xyz / max(0.00001, viewPos.w);
    }

    // Ricostruzione normale View Space dalle derivate parziali dello schermo
    vec3 getViewNormal(vec3 viewPos) {
      vec3 dX = dFdx(viewPos);
      vec3 dY = dFdy(viewPos);
      vec3 n = normalize(cross(dX, dY));
      return (n.z < 0.0) ? -n : n;
    }

    // Screen-Space Ambient Occlusion (SSAO) per cavità e fessure delle dune
    float calculateSSAO(vec3 viewPos, vec3 viewNorm, vec2 uv) {
      float occlusion = 0.0;
      vec2 texel = 1.0 / uResolution;
      float radius = 16.0;

      vec2 aoOffsets[6];
      aoOffsets[0] = vec2( 1.0,  0.0);
      aoOffsets[1] = vec2(-1.0,  0.0);
      aoOffsets[2] = vec2( 0.5,  0.86);
      aoOffsets[3] = vec2(-0.5, -0.86);
      aoOffsets[4] = vec2( 0.7, -0.7);
      aoOffsets[5] = vec2(-0.7,  0.7);

      for (int i = 0; i < 6; i++) {
        vec2 sampleUv = uv + aoOffsets[i] * texel * radius;
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;
        float sampleDepth = texture2D(tDepth, sampleUv).r;
        vec3 samplePos = getViewPosition(sampleUv, sampleDepth);
        vec3 diff = samplePos - viewPos;
        float d = length(diff);
        if (d > 0.05 && d < 3.5) {
          float aoFactor = max(0.0, dot(viewNorm, normalize(diff)));
          occlusion += aoFactor * (1.0 / (1.0 + d * 0.4));
        }
      }
      occlusion /= 6.0;
      return clamp(1.0 - occlusion * uSSAOIntensity, 0.3, 1.0);
    }

    // Screen-Space Reflections (SSR): raymarching speculare su metalli e cristalli
    vec3 rayMarchSSR(vec3 startPos, vec3 rayDir) {
      vec3 currentPos = startPos;
      float stepSize = 0.75;
      vec3 hitColor = vec3(0.0);
      float hitWeight = 0.0;

      for (int i = 0; i < 20; i++) {
        currentPos += rayDir * stepSize;
        vec4 proj = cameraProjectionMatrix * vec4(currentPos, 1.0);
        vec3 ndc = proj.xyz / max(0.00001, proj.w);
        vec2 uv = ndc.xy * 0.5 + 0.5;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

        float sceneDepth = texture2D(tDepth, uv).r;
        vec3 scenePos = getViewPosition(uv, sceneDepth);

        float depthDiff = scenePos.z - currentPos.z;
        if (depthDiff > 0.0 && depthDiff < 2.0) {
          // Ricerca binaria di precisione (3 iterazioni)
          vec3 searchPos = currentPos;
          float searchStep = stepSize * 0.5;
          for (int j = 0; j < 3; j++) {
            searchPos += (depthDiff > 0.0 ? -1.0 : 1.0) * rayDir * searchStep;
            searchStep *= 0.5;
            vec4 sProj = cameraProjectionMatrix * vec4(searchPos, 1.0);
            vec2 sUv = (sProj.xy / max(0.00001, sProj.w)) * 0.5 + 0.5;
            float sDepth = texture2D(tDepth, sUv).r;
            vec3 sPos = getViewPosition(sUv, sDepth);
            depthDiff = sPos.z - searchPos.z;
          }

          vec4 finalProj = cameraProjectionMatrix * vec4(searchPos, 1.0);
          vec2 finalUv = (finalProj.xy / max(0.00001, finalProj.w)) * 0.5 + 0.5;

          // Dissolvenza ai bordi dello schermo (Screen-Edge Fadeout)
          vec2 edgeFade = smoothstep(vec2(0.0), vec2(0.12), finalUv) *
                          smoothstep(vec2(0.0), vec2(0.12), 1.0 - finalUv);
          float fade = edgeFade.x * edgeFade.y;

          hitColor = texture2D(tDiffuse, finalUv).rgb;
          hitWeight = fade;
          break;
        }
        stepSize *= 1.08;
      }
      return hitColor * hitWeight;
    }

    void main() {
      if (uEnabled < 0.5) {
        gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
        return;
      }

      // 1. Antialiasing FXAA sul campione primario della scena
      vec3 base = applyFXAA(tDiffuse, vUv, uResolution);

      // 2. Simulazione Raytracing: SSAO e SSR (attivo solo se uRaytracingSSR > 0.5)
      if (uRaytracingSSR > 0.5) {
        float depth = texture2D(tDepth, vUv).r;
        if (depth < 0.9999) {
          vec3 viewPos = getViewPosition(vUv, depth);
          vec3 viewNorm = getViewNormal(viewPos);

          // A. Occlusione Ambientale (SSAO) per cavità e basi delle colonne
          float ao = calculateSSAO(viewPos, viewNorm, vUv);
          base *= ao;

          // B. Riflessi Screen-Space (SSR) su superfici metalliche ed emissive
          float luma = getLuma(base);
          float reflectiveFactor = smoothstep(0.42, 0.88, luma);
          if (reflectiveFactor > 0.05) {
            vec3 viewDir = normalize(viewPos);
            vec3 rayDir = reflect(viewDir, viewNorm);
            vec3 ssrReflection = rayMarchSSR(viewPos, rayDir);
            base += ssrReflection * (uSSRIntensity * reflectiveFactor);
          }
        }
      }

      // 3. Selective Bloom calibrato (campioni radiali a raggio controllato)
      vec2 texel = (1.0 / uResolution) * max(0.2, uBloomRadius * 2.0);
      vec3 bloomAcc = vec3(0.0);
      float totalWeight = 0.0;

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
        float glowFactor = max(0.0, luma - uBloomThreshold);
        bloomAcc += sampleColor * glowFactor;
        totalWeight += 1.0;
      }
      vec3 bloom = (bloomAcc / totalWeight) * uBloomIntensity;

      // 4. Color Grading: riscaldamento controllato
      vec3 graded = base + bloom;
      graded.r += uWarmth * (1.0 - graded.r) * graded.r;
      graded.g += uWarmth * 0.4 * (1.0 - graded.g) * graded.g;

      // 5. Vignette morbida periferica per incorniciare lo scavo
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
    this.raytracingSSREnabled = false;
    this.unsubs = [];

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

    // Texture 1x1 di fallback per profondità quando SSR è disattivato (zero overhead)
    this.dummyDepthTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.dummyDepthTexture.needsUpdate = true;

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
    this.postMaterial.uniforms.tDepth.value = this.dummyDepthTexture;
    this.postMaterial.uniforms.uResolution.value.set(w, h);
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.postQuad = new THREE.Mesh(quadGeo, this.postMaterial);
    this.postScene = new THREE.Scene();
    this.postScene.add(this.postQuad);

    // Sottoscrizione alle impostazioni
    if (this.settings) {
      this.unsubs.push(
        this.settings.subscribe('graphics.postProcessing', (val) => {
          this.setEnabled(!!val);
        })
      );

      const initialSSR = !!(this.settings.get('graphics.raytracingSSR') || this.settings.get('raytracingSSR'));
      this.setRaytracingSSREnabled(initialSSR);

      this.unsubs.push(
        this.settings.subscribe('graphics.raytracingSSR', (val) => {
          this.setRaytracingSSREnabled(!!val);
        }),
        this.settings.subscribe('raytracingSSR', (val) => {
          this.setRaytracingSSREnabled(!!val);
        })
      );
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;
  }

  setRaytracingSSREnabled(val) {
    this.raytracingSSREnabled = !!val;
    if (this.raytracingSSREnabled) {
      if (!this.renderTarget.depthTexture) {
        this.renderTarget.depthTexture = new THREE.DepthTexture();
        this.renderTarget.depthTexture.type = THREE.UnsignedShortType;
      }
      this.postMaterial.uniforms.tDepth.value = this.renderTarget.depthTexture;
      this.postMaterial.uniforms.uRaytracingSSR.value = 1.0;
    } else {
      if (this.renderTarget.depthTexture) {
        this.renderTarget.depthTexture.dispose();
        this.renderTarget.depthTexture = null;
      }
      this.postMaterial.uniforms.tDepth.value = this.dummyDepthTexture;
      this.postMaterial.uniforms.uRaytracingSSR.value = 0.0;
    }
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

    // Sincronizza matriche camera per la ricostruzione view-space del raymarching
    if (this.raytracingSSREnabled && this.camera) {
      this.camera.updateMatrixWorld?.();
      this.camera.updateProjectionMatrix?.();
      this.postMaterial.uniforms.cameraNear.value = this.camera.near;
      this.postMaterial.uniforms.cameraFar.value = this.camera.far;
      this.postMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
      if (this.camera.projectionMatrixInverse) {
        this.postMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
      }
    }

    // 1. Render della scena 3D principale nel buffer texture (colore e profondità)
    const currentTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 2. Compositing a schermo intero (bloom + vignette + color grading + SSR + SSAO + antialiasing)
    this.renderer.setRenderTarget(currentTarget);
    this.renderer.render(this.postScene, this.postCamera);
  }

  dispose() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.renderTarget.depthTexture) {
      this.renderTarget.depthTexture.dispose();
      this.renderTarget.depthTexture = null;
    }
    this.dummyDepthTexture?.dispose();
    this.renderTarget?.dispose();
    this.postMaterial?.dispose();
    this.postQuad?.geometry?.dispose();
  }
}
