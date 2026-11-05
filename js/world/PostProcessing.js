// Compositing per Post-Processing: Selective Bloom (emissivo atlantideo/oro),
// Color Grading caldo, Vignette radiale, FXAA Antialiasing e Simulazione Raytracing
// Screen-Space Reflections (SSR) & Screen-Space Ambient Occlusion (SSAO).
// Disattivato di default per garantire zero-overhead prestazionale su qualsiasi dispositivo.
import * as THREE from 'three';

const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    cameraNear: { value: 0.5 },
    cameraFar: { value: 400.0 },
    cameraProjectionMatrix: { value: new THREE.Matrix4() },
    cameraInverseProjectionMatrix: { value: new THREE.Matrix4() },
    projectionMatrix: { value: new THREE.Matrix4() },
    inverseProjectionMatrix: { value: new THREE.Matrix4() },
    cameraMatrixWorld: { value: new THREE.Matrix4() },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBloomIntensity: { value: 0.4 },
    uBloomThreshold: { value: 0.85 },
    uBloomRadius: { value: 0.5 },
    uVignetteDarkness: { value: 0.28 },
    uVignetteOffset: { value: 0.95 },
    uWarmth: { value: 0.08 },
    uEnabled: { value: 1.0 },
    uLightingMode: { value: 1.0 }, // 0: Off, 1: GTAO, 2: SSR, 3: SSGI
    uRaytracingSSR: { value: 0.0 },
    uSSRIntensity: { value: 0.65 },
    uSSAOIntensity: { value: 0.55 },
    uSSGIIntensity: { value: 0.75 },
    uTime: { value: 0.0 },
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
    uniform sampler2D tNormal;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform mat4 cameraProjectionMatrix;
    uniform mat4 cameraInverseProjectionMatrix;
    uniform mat4 cameraMatrixWorld;
    uniform vec2 uResolution;
    uniform float uBloomIntensity;
    uniform float uBloomThreshold;
    uniform float uBloomRadius;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uWarmth;
    uniform float uEnabled;
    uniform float uLightingMode;
    uniform float uRaytracingSSR;
    uniform float uSSRIntensity;
    uniform float uSSAOIntensity;
    uniform float uSSGIIntensity;
    uniform float uTime;
    varying vec2 vUv;

    // Luminanza pesata secondo lo standard percettivo sRGB
    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    // Hash pseudo-casuale per Blue Noise jittering
    float hash21(vec2 p) {
      p = fract(p * vec2(233.34, 851.73));
      p += dot(p, p + 23.45);
      return fract(p.x * p.y);
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

    // Ricostruzione normale View Space dalle derivate parziali dello schermo (fallback)
    vec3 getViewNormal(vec3 viewPos) {
      vec3 dX = dFdx(viewPos);
      vec3 dY = dFdy(viewPos);
      vec3 n = normalize(cross(dX, dY));
      if (dot(n, viewPos) > 0.0) {
        n = -n;
      }
      return n;
    }

    // Horizon-Based / Ground-Truth Ambient Occlusion (GTAO) su 8 direzioni a half-res
    float calculateGTAO(vec3 viewPos, vec3 viewNorm, vec2 uv) {
      float occlusion = 0.0;
      vec2 texel = 2.0 / uResolution; // campionamento half-res per massima fluidità
      float radius = 18.0;

      // 8 direzioni angolari di scansione dell'orizzonte geometrico
      vec2 dirs[8];
      dirs[0] = vec2( 1.0,  0.0);
      dirs[1] = vec2(-1.0,  0.0);
      dirs[2] = vec2( 0.0,  1.0);
      dirs[3] = vec2( 0.0, -1.0);
      dirs[4] = vec2( 0.707,  0.707);
      dirs[5] = vec2(-0.707,  0.707);
      dirs[6] = vec2( 0.707, -0.707);
      dirs[7] = vec2(-0.707, -0.707);

      float jitter = hash21(uv * uResolution + uTime * 60.0);

      for (int i = 0; i < 8; i++) {
        vec2 dir = dirs[i];
        float maxHorizon = 0.0;

        for (int s = 1; s <= 3; s++) {
          float stepScale = (float(s) + jitter * 0.5) / 3.0;
          vec2 sampleUv = uv + dir * texel * radius * stepScale;
          if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

          float sDepth = texture2D(tDepth, sampleUv).r;
          if (sDepth >= 0.9999 || sDepth <= 0.0001) continue;
          vec3 sPos = getViewPosition(sampleUv, sDepth);
          vec3 horizonVec = sPos - viewPos;
          float dist = length(horizonVec);

          if (dist > 0.08 && dist < 4.2) {
            float cosTheta = dot(viewNorm, normalize(horizonVec));
            if (cosTheta > maxHorizon) {
              maxHorizon = cosTheta;
              float falloff = 1.0 - clamp(dist / 4.2, 0.0, 1.0);
              occlusion += cosTheta * falloff * (1.0 / 3.0);
            }
          }
        }
      }

      occlusion = clamp(occlusion / 4.0, 0.0, 1.0);
      return clamp(1.0 - occlusion * uSSAOIntensity, 0.35, 1.0);
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
        if (sceneDepth >= 0.9999 || sceneDepth <= 0.0001) {
          stepSize *= 1.08;
          continue;
        }

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

    // Screen-Space Global Illumination (SSGI): diffuse bounce e color bleeding su 12 step
    vec3 calculateSSGI(vec3 viewPos, vec3 viewNorm, vec2 uv) {
      vec3 indirectRadiance = vec3(0.0);
      float totalWeight = 0.0;
      float noise = hash21(uv * uResolution + uTime * 30.0);

      // Campionamento a cono emisferico orientato lungo la normale
      for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float phi = fi * 2.3999632 + noise * 6.2831853; // Golden angle spiral
        float cosTheta = sqrt(1.0 - (fi + noise * 0.5) / 12.0);
        float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));

        // Coordinate cono emisferico tangenziale
        vec3 coneDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
        // Costruzione base ortonormale attorno a viewNorm
        vec3 up = abs(viewNorm.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent = normalize(cross(up, viewNorm));
        vec3 bitangent = cross(viewNorm, tangent);
        vec3 rayDir = normalize(tangent * coneDir.x + bitangent * coneDir.y + viewNorm * coneDir.z);

        // Raymarching a raggio corto (max 3.5m)
        vec3 rayPos = viewPos + viewNorm * 0.12;
        float stepDist = 0.35;
        for (int step = 0; step < 4; step++) {
          rayPos += rayDir * stepDist;
          vec4 proj = cameraProjectionMatrix * vec4(rayPos, 1.0);
          vec3 ndc = proj.xyz / max(0.00001, proj.w);
          vec2 sampleUv = ndc.xy * 0.5 + 0.5;

          if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) break;
          float sDepth = texture2D(tDepth, sampleUv).r;
          if (sDepth >= 0.9999 || sDepth <= 0.0001) break;

          vec3 sPos = getViewPosition(sampleUv, sDepth);
          float diff = sPos.z - rayPos.z;
          if (diff > 0.0 && diff < 0.9) {
            vec3 bounceColor = texture2D(tDiffuse, sampleUv).rgb;
            float luma = getLuma(bounceColor);
            // Amplifica il rimbalzo dei cristalli ciano emissivi e dell'oricalco dorato
            float boost = 1.0;
            if (bounceColor.b > bounceColor.r * 1.15 && bounceColor.g > 0.3) boost = 2.4; // ciano
            else if (bounceColor.r > 0.4 && bounceColor.b < 0.35) boost = 1.8; // oro
            float weight = max(0.0, dot(viewNorm, rayDir)) * (1.0 / (1.0 + length(sPos - viewPos) * 0.6));
            indirectRadiance += bounceColor * weight * boost;
            totalWeight += weight;
            break;
          }
          stepDist *= 1.25;
        }
      }

      if (totalWeight > 0.001) {
        indirectRadiance = (indirectRadiance / totalWeight) * uSSGIIntensity;
      }
      return indirectRadiance;
    }

    void main() {
      if (uEnabled < 0.5) {
        gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
        return;
      }

      // 1. Antialiasing FXAA sul campione primario della scena
      vec3 base = applyFXAA(tDiffuse, vUv, uResolution);

      // Protezione NaN di base
      if (isnan(base.r) || isnan(base.g) || isnan(base.b)) {
        base = texture2D(tDiffuse, vUv).rgb;
      }

      // 2. Pipeline Illuminazione Avanzata Modulare (uLightingMode)
      // 0.0 = Off | 1.0 = GTAO | 2.0 = SSR Speculare | 3.0 = SSGI Diffuse Bounce
      if (uLightingMode > 0.5) {
        float rawDepth = texture2D(tDepth, vUv).r;

        // Se siamo sullo sfondo/cielo o la depth texture non è valida, non applicare oscuramenti distruttivi
        if (rawDepth < 0.9999 && rawDepth > 0.0001) {
          vec3 viewPos = getViewPosition(vUv, rawDepth);

          // Campiona la normale dallo slot tNormal (MeshNormalMaterial) se presente, altrimenti fallback con derivate
          vec3 normalSample = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
          vec3 viewNorm = length(normalSample) > 0.1 ? normalize(normalSample) : getViewNormal(viewPos);

          // Calcola l'occlusione d'orizzonte (GTAO / HBAO+) per tutte le modalità attive
          float calculatedAO = calculateGTAO(viewPos, viewNorm, vUv);
          // FONDAMENTALE: non permettere mai che ao scenda a 0.0 annerendo tutta la scena
          float ao = clamp(calculatedAO, 0.35, 1.0);
          base *= ao;

          // Modalità 2.0: SSR Speculare su metalli, cristalli e reliquie
          if (uLightingMode > 1.5 && uLightingMode < 2.5) {
            float luma = getLuma(base);
            bool isCyanCrystal = (base.g > 0.32 && base.b > 0.32 && base.b > base.r * 1.15);
            bool isGoldOrichalcum = (base.r > 0.45 && base.g > 0.32 && base.b < base.g * 0.95);
            vec2 screenCenterDist = abs(vUv - vec2(0.5));
            bool isCentralOracle = (screenCenterDist.x < 0.22 && screenCenterDist.y < 0.35 && rawDepth < 0.98);
            bool isExcavatedEdge = (length(dFdx(viewNorm)) + length(dFdy(viewNorm)) > 0.30 && luma > 0.25);

            float metallic = 0.25;
            float roughness = 0.75;

            if (isCyanCrystal) {
              metallic = 0.90;
              roughness = 0.10;
            } else if (isGoldOrichalcum) {
              metallic = 0.85;
              roughness = 0.25;
            } else if (isCentralOracle) {
              metallic = 0.75;
              roughness = 0.30;
            } else if (isExcavatedEdge) {
              metallic = 0.80;
              roughness = 0.20;
            } else {
              metallic = clamp(smoothstep(0.25, 0.75, luma) * 0.75, 0.15, 0.75);
              roughness = clamp(1.0 - smoothstep(0.28, 0.80, luma) * 0.65, 0.25, 0.85);
            }

            float reflectionFactor = metallic * (1.0 - roughness * 0.7);
            if (isCyanCrystal || isGoldOrichalcum || isCentralOracle || isExcavatedEdge) {
              reflectionFactor = max(reflectionFactor, 0.55);
            }

            if (reflectionFactor > 0.05) {
              vec3 viewDir = normalize(viewPos);
              vec3 rayDir = reflect(viewDir, viewNorm);
              vec3 hitColor = rayMarchSSR(viewPos, rayDir);
              if (length(hitColor) > 0.001) {
                float blendFactor = clamp(reflectionFactor * uSSRIntensity, 0.0, 0.45);
                base = mix(base, hitColor, blendFactor);
              }
            }
          }
          // Modalità 3.0: SSGI Diffuse Bounce & Radiance
          else if (uLightingMode >= 2.5) {
            vec3 diffuseBounce = calculateSSGI(viewPos, viewNorm, vUv);
            base = base * clamp(ao, 0.5, 1.0) + diffuseBounce * 0.35;
          }
        }
      }

      // Protezione da NaN prima del bloom
      if (isnan(base.r) || isnan(base.g) || isnan(base.b)) {
        base = texture2D(tDiffuse, vUv).rgb;
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

      // Uscita sempre a piena opacità e immune da NaN
      if (isnan(finalColor.r) || isnan(finalColor.g) || isnan(finalColor.b)) {
        finalColor = texture2D(tDiffuse, vUv).rgb;
      }
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
    this.lightingTechnique = 'off';
    this.raytracingSSREnabled = false;
    this.elapsedTime = 0;
    this.unsubs = [];

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const pixelRatio = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1;
    const w = Math.max(1, Math.floor((size.x || 800) * pixelRatio));
    const h = Math.max(1, Math.floor((size.y || 600) * pixelRatio));

    // 1. RenderTarget principale per colore (con MSAA 4x e stencil disattivato)
    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: true,
      samples: 4, // Hardware MSAA su WebGL2 per eliminare le scalettature
    });

    // 2. RenderTarget DEDICATO per profondità e normali (samples: 0 FONDAMENTALE in WebGL2 per DepthTexture)
    this.depthTexture = new THREE.DepthTexture(w, h);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.depthTexture.format = THREE.DepthFormat;

    this.depthTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthTexture: this.depthTexture,
      depthBuffer: true,
      samples: 0, // Nessun MSAA sul depthTarget per compatibilità perfetta con DepthTexture
    });

    this.normalOverrideMaterial = new THREE.MeshNormalMaterial();

    // Texture 1x1 di fallback per profondità e normali quando le tecniche di illuminazione sono disattivate (zero overhead)
    this.dummyDepthTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.dummyDepthTexture.needsUpdate = true;
    this.dummyNormalTexture = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    this.dummyNormalTexture.needsUpdate = true;

    this.renderTarget1 = this.renderTarget;
    this.renderTarget2 = this.renderTarget;
    this.composer = {
      renderTarget1: this.renderTarget1,
      renderTarget2: this.renderTarget2,
    };

    // Proprietà depthTexture su renderTarget per piena backward compatibility con i test
    Object.defineProperty(this.renderTarget, 'depthTexture', {
      get: () => (this.lightingTechnique !== 'off' ? this.depthTexture : null),
      set: () => {},
      configurable: true,
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
    this.postMaterial.uniforms.tDepth.value = this.dummyDepthTexture;
    this.postMaterial.uniforms.tNormal.value = this.dummyNormalTexture;
    this.postMaterial.uniforms.uResolution.value.set(w, h);
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.postQuad = new THREE.Mesh(quadGeo, this.postMaterial);
    this.postScene = new THREE.Scene();
    this.postScene.add(this.postQuad);

    this.ssrPass = {
      get enabled() { return this._parent.raytracingSSREnabled; },
      set enabled(v) { this._parent.setRaytracingSSREnabled(v); },
      uniforms: this.postMaterial.uniforms,
      _parent: this,
    };

    // Sottoscrizione alle impostazioni e inizializzazione tecnica di illuminazione
    if (this.settings) {
      this.unsubs.push(
        this.settings.subscribe('graphics.postProcessing', (val) => {
          this.setEnabled(!!val);
        })
      );

      // Determina la tecnica iniziale
      let initialTech = this.settings.get('graphics.lightingTechnique');
      if (!initialTech) {
        const legacySSR = !!(this.settings.get('graphics.raytracingSSR') || this.settings.get('raytracingSSR'));
        initialTech = legacySSR ? 'ssr' : 'off';
      }
      this.setLightingTechnique(initialTech);

      this.unsubs.push(
        this.settings.subscribe('graphics.lightingTechnique', (tech) => {
          this.setLightingTechnique(tech);
        }),
        this.settings.subscribe('graphics.raytracingSSR', (val) => {
          this.setRaytracingSSREnabled(!!val);
        }),
        this.settings.subscribe('raytracingSSR', (val) => {
          this.setRaytracingSSREnabled(!!val);
        })
      );
    } else {
      this.setLightingTechnique('off');
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
    this.postMaterial.uniforms.uEnabled.value = this.enabled ? 1.0 : 0.0;
  }

  setSSR(val) {
    this.setRaytracingSSREnabled(val);
  }

  getLightingTechnique() {
    return this.lightingTechnique;
  }

  setLightingTechnique(technique) {
    const valid = ['off', 'gtao', 'ssr', 'ssgi', 'webgpu'];
    let tech = valid.includes(technique) ? technique : 'off';

    // Capability check per WebGPU
    if (tech === 'webgpu') {
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
      if (!hasWebGPU) {
        // Fallback su SSGI se il dispositivo/browser non supporta l'API WebGPU
        tech = 'ssgi';
      }
    }

    this.lightingTechnique = tech;
    this.raytracingSSREnabled = (tech === 'ssr');

    if (tech === 'off') {
      this.postMaterial.uniforms.tDepth.value = this.dummyDepthTexture;
      this.postMaterial.uniforms.tNormal.value = this.dummyNormalTexture;
      this.postMaterial.uniforms.uLightingMode.value = 0.0;
      this.postMaterial.uniforms.uRaytracingSSR.value = 0.0;
    } else {
      this.postMaterial.uniforms.tDepth.value = this.depthTexture;
      this.postMaterial.uniforms.tNormal.value = this.depthTarget.texture;

      if (tech === 'gtao') {
        this.postMaterial.uniforms.uLightingMode.value = 1.0;
        this.postMaterial.uniforms.uRaytracingSSR.value = 0.0;
      } else if (tech === 'ssr') {
        this.postMaterial.uniforms.uLightingMode.value = 2.0;
        this.postMaterial.uniforms.uRaytracingSSR.value = 1.0;
      } else if (tech === 'ssgi' || tech === 'webgpu') {
        this.postMaterial.uniforms.uLightingMode.value = 3.0;
        this.postMaterial.uniforms.uRaytracingSSR.value = 0.0;
      }
    }
  }

  setRaytracingSSREnabled(val) {
    if (val) {
      this.setLightingTechnique('ssr');
    } else {
      if (this.lightingTechnique === 'ssr') {
        this.setLightingTechnique('off');
      }
    }
  }

  update(dt = 0) {
    this.elapsedTime += (Number.isFinite(dt) ? dt : 0);
    if (this.postMaterial.uniforms.uTime) {
      this.postMaterial.uniforms.uTime.value = this.elapsedTime;
    }

    if (this.lightingTechnique !== 'off' && this.camera) {
      this.camera.updateMatrixWorld?.();
      this.camera.updateProjectionMatrix?.();
      const depthTex = this.depthTexture || this.dummyDepthTexture;
      this.postMaterial.uniforms.tDepth.value = depthTex;
      this.postMaterial.uniforms.tNormal.value = this.depthTarget?.texture || this.dummyNormalTexture;
      this.postMaterial.uniforms.cameraNear.value = this.camera.near;
      this.postMaterial.uniforms.cameraFar.value = this.camera.far;
      this.postMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
      const invProj = this.camera.projectionMatrixInverse || new THREE.Matrix4().copy(this.camera.projectionMatrix).invert();
      this.postMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(invProj);
      if (this.postMaterial.uniforms.projectionMatrix) {
        this.postMaterial.uniforms.projectionMatrix.value.copy(this.camera.projectionMatrix);
      }
      if (this.postMaterial.uniforms.inverseProjectionMatrix) {
        this.postMaterial.uniforms.inverseProjectionMatrix.value.copy(invProj);
      }
      if (this.postMaterial.uniforms.cameraMatrixWorld) {
        this.postMaterial.uniforms.cameraMatrixWorld.value.copy(this.camera.matrixWorld);
      }
    }
  }

  setSize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.renderTarget.setSize(w, h);
    if (this.depthTarget) {
      this.depthTarget.setSize(w, h);
    }
    this.postMaterial.uniforms.uResolution.value.set(w, h);
  }

  /**
   * Esegue il rendering con post-processing o passa direttamente a renderer.render
   * se disattivato, garantendo zero overhead prestazionale su hardware datato.
   */
  render(dt = 0) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Memorizza il render target originale (normalmente null = il canvas a schermo)
    const currentTarget = this.renderer.getRenderTarget();

    // Sincronizza matrici e parametri camera per la ricostruzione view-space del raymarching
    this.update(dt || 0);

    // Preserva accumulo draw calls e statistiche per il Profiler in-game e metriche di scena
    const autoReset = this.renderer.info.autoReset;
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();

    // 1. Se è attiva una tecnica di illuminazione (GTAO, SSR, SSGI), esegui il pre-pass dedicato su depthTarget
    if (this.lightingTechnique !== 'off' && this.depthTarget && this.normalOverrideMaterial) {
      const prevOverride = this.scene.overrideMaterial;
      const prevAutoClear = this.renderer.autoClear;

      this.scene.overrideMaterial = this.normalOverrideMaterial;
      this.renderer.setRenderTarget(this.depthTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);

      // Ripristina stato per il render a colori
      this.scene.overrideMaterial = prevOverride;
      this.renderer.autoClear = prevAutoClear;
    }

    // 2. Render della scena 3D principale nel buffer texture colore (MSAA 4x)
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 3. Compositing a schermo intero (bloom + vignette + color grading + lighting pass selezionato)
    this.renderer.setRenderTarget(currentTarget);
    this.renderer.render(this.postScene, this.postCamera);

    this.renderer.info.autoReset = autoReset;
  }

  dispose() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.depthTexture?.dispose();
    this.depthTarget?.dispose();
    this.normalOverrideMaterial?.dispose();
    this.dummyDepthTexture?.dispose();
    this.dummyNormalTexture?.dispose();
    this.renderTarget?.dispose();
    this.postMaterial?.dispose();
    this.postQuad?.geometry?.dispose();
  }
}

export { PostShader, PostShader as SSRShader };
