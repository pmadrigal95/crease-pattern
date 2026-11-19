/**
 * Whether this device gets M4's 3D scene (decision 50): WebGL2, at least 4 GB of memory, and no
 * request for reduced motion. Everyone else keeps the SVG fox, a complete picture on its own.
 *
 * Safari and Firefox don't report memory (navigator.deviceMemory); there, at least 4 logical cores
 * stand in for it, so a capable laptop isn't left out and an old phone isn't loaded down.
 */
export interface Device {
  webgl2: boolean;
  /** GB, rounded by the browser; undefined where it isn't exposed. */
  deviceMemory?: number | undefined;
  cores?: number | undefined;
  reducedMotion: boolean;
}

export const MIN_MEMORY_GB = 4;
export const MIN_CORES = 4;

export const canRun3D = (device: Device): boolean => {
  if (!device.webgl2 || device.reducedMotion) return false;
  if (device.deviceMemory !== undefined) return device.deviceMemory >= MIN_MEMORY_GB;
  return (device.cores ?? 0) >= MIN_CORES;
};

/**
 * Reads this browser. Creating a throwaway WebGL2 context is the only reliable test; asking it to
 * fail on a major performance caveat turns away software rendering (no usable GPU), and the
 * context is released right after.
 */
export const detectDevice = (): Device => {
  let webgl2 = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webgl2 = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Some browsers throw instead of returning null; webgl2 stays false.
  }
  return {
    webgl2,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    cores: navigator.hardwareConcurrency,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
};
