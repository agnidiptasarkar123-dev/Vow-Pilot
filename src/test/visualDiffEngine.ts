import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface VisualDiffResult {
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  isSameDimensions: boolean;
  passed: boolean;
  diffImagePath?: string;
  baselinePath: string;
  currentPath: string;
}

export interface VisualDiffOptions {
  threshold?: number; // Matching threshold (0 to 1); smaller means more sensitive. Default: 0.1
  maxDiffPercentage?: number; // Allowed percentage of different pixels. Default: 1.0 (1%)
  includeAA?: boolean; // Whether to detect and ignore anti-aliased pixels. Default: true
  diffColor?: [number, number, number]; // RGB color for diff pixels. Default: red [255, 0, 0]
}

/**
 * Compares two PNG images on disk and writes a visual diff image if differences exist.
 */
export function comparePngFiles(
  baselinePath: string,
  currentPath: string,
  diffOutputPath?: string,
  options: VisualDiffOptions = {}
): VisualDiffResult {
  const threshold = options.threshold ?? 0.1;
  const maxDiffPercentage = options.maxDiffPercentage ?? 1.0;
  const includeAA = options.includeAA ?? true;

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline image does not exist at: ${baselinePath}`);
  }
  if (!fs.existsSync(currentPath)) {
    throw new Error(`Current image does not exist at: ${currentPath}`);
  }

  const baselineData = fs.readFileSync(baselinePath);
  const currentData = fs.readFileSync(currentPath);

  const baselinePng = PNG.sync.read(baselineData);
  const currentPng = PNG.sync.read(currentData);

  const isSameDimensions =
    baselinePng.width === currentPng.width && baselinePng.height === currentPng.height;

  if (!isSameDimensions) {
    return {
      totalPixels: baselinePng.width * baselinePng.height,
      diffPixels: baselinePng.width * baselinePng.height,
      diffPercentage: 100.0,
      isSameDimensions: false,
      passed: false,
      baselinePath,
      currentPath,
    };
  }

  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    width,
    height,
    {
      threshold,
      includeAA,
      diffColor: options.diffColor ?? [225, 29, 72], // Rose red for high visibility
    }
  );

  const totalPixels = width * height;
  const diffPercentage = (diffPixels / totalPixels) * 100;
  const passed = diffPercentage <= maxDiffPercentage;

  if (diffOutputPath) {
    const dir = path.dirname(diffOutputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diffPng));
  }

  return {
    totalPixels,
    diffPixels,
    diffPercentage,
    isSameDimensions: true,
    passed,
    diffImagePath: diffOutputPath,
    baselinePath,
    currentPath,
  };
}
