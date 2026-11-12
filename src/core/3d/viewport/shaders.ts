/**
 * ============================================================================
 * VIEWPORT SHADING SHADERS (Phase 3D-018 & Phase 3D-019)
 * ============================================================================
 * WebGL2 / GLSL ES 3.00 shader source strings and uniform bindings for:
 * 1. Solid: 3-point studio lighting + curvature-based cavity darkening.
 * 2. Wireframe-on-shaded: single-pass barycentric antialiased edge overlay.
 * 3. Normal-visualization: surface normal mapped to RGB color [0, 1].
 * 4. Face-orientation: blue front (CCW) / red back (CW) face diagnostic.
 * 5. Selection outline: inverted hull expanded along vertex normal.
 * ============================================================================
 */

import type { ShadingMode, ViewportSettings } from "./settings";

// ---------------------------------------------------------------------------
// 1. Solid Shader
// ---------------------------------------------------------------------------

/**
 * Solid Vertex Shader
 * Uniforms: uModelMatrix, uViewMatrix, uProjectionMatrix, uNormalMatrix
 */
export const SOLID_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

out vec3 vWorldNormal;
out vec3 vWorldPosition;

void main() {
  vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
}
`;

/**
 * Solid Fragment Shader: studio lighting from 3 fixed lights + cavity-like darkening via curvature
 * Uniforms: uBaseColor, uRoughness, uCavityStrength
 */
export const SOLID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vWorldNormal;
in vec3 vWorldPosition;

uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uCavityStrength;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vWorldNormal);

  // 3-point studio lighting directions (Key, Fill, Rim)
  vec3 L1 = normalize(vec3(0.577, 0.816, 0.408));
  vec3 L2 = normalize(vec3(-0.707, -0.354, -0.612));
  vec3 L3 = normalize(vec3(0.0, -0.707, 0.707));

  float keyLight = max(dot(N, L1), 0.0) * 0.8;
  float fillLight = max(dot(N, L2), 0.0) * 0.35;
  float rimLight = max(dot(N, L3), 0.0) * 0.25;
  float ambient = 0.2;

  float totalDiffuse = ambient + keyLight + fillLight + rimLight;

  // Cavity-like darkening via screen-space normal derivative (curvature term)
  vec3 dNdx = dFdx(N);
  vec3 dNdy = dFdy(N);
  float curvature = length(dNdx) + length(dNdy);
  float cavity = clamp(1.0 - curvature * uCavityStrength * 2.5, 0.0, 1.0);

  vec3 finalColor = uBaseColor * totalDiffuse * cavity;
  fragColor = vec4(finalColor, 1.0);
}
`;

// ---------------------------------------------------------------------------
// 2. Wireframe-on-Shaded Shader (Barycentric)
// ---------------------------------------------------------------------------

/**
 * Wireframe Vertex Shader
 * Uniforms: uModelMatrix, uViewMatrix, uProjectionMatrix
 */
export const WIREFRAME_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aBarycentric;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vBarycentric;

void main() {
  vBarycentric = aBarycentric;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

/**
 * Wireframe Fragment Shader: barycentric wireframe on shaded background
 * Uniforms: uWireColor, uWireWidth, uBaseColor
 */
export const WIREFRAME_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vBarycentric;

uniform vec4 uWireColor;
uniform float uWireWidth;
uniform vec4 uBaseColor;

out vec4 fragColor;

void main() {
  vec3 d = fwidth(vBarycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * uWireWidth, vBarycentric);
  float edgeFactor = min(min(a3.x, a3.y), a3.z);
  fragColor = mix(uWireColor, uBaseColor, edgeFactor);
}
`;

// ---------------------------------------------------------------------------
// 3. Normal-Visualization Shader
// ---------------------------------------------------------------------------

/**
 * Normal Visualization Vertex Shader
 * Uniforms: uModelMatrix, uViewMatrix, uProjectionMatrix, uNormalMatrix
 */
export const NORMAL_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

out vec3 vNormal;

void main() {
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

/**
 * Normal Visualization Fragment Shader: maps surface normal from [-1, 1] to RGB [0, 1]
 * Uniforms: uOpacity
 */
export const NORMAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vNormal;

uniform float uOpacity;

out vec4 fragColor;

void main() {
  vec3 rgb = normalize(vNormal) * 0.5 + 0.5;
  fragColor = vec4(rgb, uOpacity);
}
`;

// ---------------------------------------------------------------------------
// 4. Face-Orientation Shader
// ---------------------------------------------------------------------------

/**
 * Face Orientation Vertex Shader
 * Uniforms: uModelMatrix, uViewMatrix, uProjectionMatrix
 */
export const FACE_ORIENTATION_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

/**
 * Face Orientation Fragment Shader: diagnostic blue front / red back orientation
 * Uniforms: uFrontColor, uBackColor
 */
export const FACE_ORIENTATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 uFrontColor;
uniform vec4 uBackColor;

out vec4 fragColor;

void main() {
  fragColor = gl_FrontFacing ? uFrontColor : uBackColor;
}
`;

// ---------------------------------------------------------------------------
// 5. Selection Outline Shader (Inverted Hull)
// ---------------------------------------------------------------------------

/**
 * Selection Outline Vertex Shader: expands geometry along vertex normals
 * Uniforms: uModelMatrix, uViewMatrix, uProjectionMatrix, uNormalMatrix, uOutlineWidth
 */
export const OUTLINE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
uniform float uOutlineWidth;

void main() {
  vec3 norm = normalize(uNormalMatrix * aNormal);
  vec4 viewPos = uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
  viewPos.xyz += norm * uOutlineWidth;
  gl_Position = uProjectionMatrix * viewPos;
}
`;

/**
 * Selection Outline Fragment Shader: solid silhouette color
 * Uniforms: uOutlineColor
 */
export const OUTLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 uOutlineColor;

out vec4 fragColor;

void main() {
  fragColor = uOutlineColor;
}
`;

// ---------------------------------------------------------------------------
// Shader Registry & Contract Data
// ---------------------------------------------------------------------------

export interface ShaderContract {
  name: string;
  glsl: string;
  docUniforms: string[];
}

export const VIEWPORT_SHADERS = {
  solid: { vertex: SOLID_VERTEX_SHADER, fragment: SOLID_FRAGMENT_SHADER },
  wireframeOnShaded: { vertex: WIREFRAME_VERTEX_SHADER, fragment: WIREFRAME_FRAGMENT_SHADER },
  normal: { vertex: NORMAL_VERTEX_SHADER, fragment: NORMAL_FRAGMENT_SHADER },
  faceOrientation: { vertex: FACE_ORIENTATION_VERTEX_SHADER, fragment: FACE_ORIENTATION_FRAGMENT_SHADER },
  outline: { vertex: OUTLINE_VERTEX_SHADER, fragment: OUTLINE_FRAGMENT_SHADER },
} as const;

export const ALL_VIEWPORT_SHADERS: readonly ShaderContract[] = [
  {
    name: "solid_vertex",
    glsl: SOLID_VERTEX_SHADER,
    docUniforms: ["uModelMatrix", "uViewMatrix", "uProjectionMatrix", "uNormalMatrix"],
  },
  {
    name: "solid_fragment",
    glsl: SOLID_FRAGMENT_SHADER,
    docUniforms: ["uBaseColor", "uRoughness", "uCavityStrength"],
  },
  {
    name: "wireframe_vertex",
    glsl: WIREFRAME_VERTEX_SHADER,
    docUniforms: ["uModelMatrix", "uViewMatrix", "uProjectionMatrix"],
  },
  {
    name: "wireframe_fragment",
    glsl: WIREFRAME_FRAGMENT_SHADER,
    docUniforms: ["uWireColor", "uWireWidth", "uBaseColor"],
  },
  {
    name: "normal_vertex",
    glsl: NORMAL_VERTEX_SHADER,
    docUniforms: ["uModelMatrix", "uViewMatrix", "uProjectionMatrix", "uNormalMatrix"],
  },
  {
    name: "normal_fragment",
    glsl: NORMAL_FRAGMENT_SHADER,
    docUniforms: ["uOpacity"],
  },
  {
    name: "face_orientation_vertex",
    glsl: FACE_ORIENTATION_VERTEX_SHADER,
    docUniforms: ["uModelMatrix", "uViewMatrix", "uProjectionMatrix"],
  },
  {
    name: "face_orientation_fragment",
    glsl: FACE_ORIENTATION_FRAGMENT_SHADER,
    docUniforms: ["uFrontColor", "uBackColor"],
  },
  {
    name: "outline_vertex",
    glsl: OUTLINE_VERTEX_SHADER,
    docUniforms: ["uModelMatrix", "uViewMatrix", "uProjectionMatrix", "uNormalMatrix", "uOutlineWidth"],
  },
  {
    name: "outline_fragment",
    glsl: OUTLINE_FRAGMENT_SHADER,
    docUniforms: ["uOutlineColor"],
  },
] as const;

// ---------------------------------------------------------------------------
// Uniform Helpers
// ---------------------------------------------------------------------------

/**
 * Returns plain uniform values for the given shading mode and viewport settings.
 */
export function uniformsFor(
  mode: ShadingMode,
  settings: ViewportSettings
): Record<string, unknown> {
  const common = {
    uXray: settings.xray ? 1.0 : 0.0,
    uCavityStrength: settings.solidOptions.cavity ? 0.35 : 0.0,
    uWireWidth: 1.0,
    uWireColor: [0.15, 0.15, 0.15, 1.0],
    uFrontColor: [0.18, 0.44, 0.88, 1.0], // Blue front
    uBackColor: [0.88, 0.18, 0.18, 1.0],  // Red back
    uOutlineColor: [1.0, 0.55, 0.0, 1.0], // Orange selection outline
    uOutlineWidth: 0.02,
    uOpacity: 1.0,
  };

  switch (mode) {
    case "wireframe":
      return {
        ...common,
        uBaseColor: [0.0, 0.0, 0.0, 0.0],
        uRoughness: 1.0,
      };

    case "solid":
      return {
        ...common,
        uBaseColor: [0.8, 0.8, 0.8],
        uRoughness: 0.5,
      };

    case "material":
      return {
        ...common,
        uBaseColor: [0.9, 0.9, 0.9],
        uRoughness: 0.3,
      };

    case "rendered":
      return {
        ...common,
        uBaseColor: [1.0, 1.0, 1.0],
        uRoughness: 0.5,
      };

    default:
      return common;
  }
}
