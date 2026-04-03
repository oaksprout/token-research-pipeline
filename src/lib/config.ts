import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { PortfolioConfig, SectorsConfig, TokensConfig } from './types.js';

const ROOT = resolve(import.meta.dirname, '..', '..');

function loadYaml<T>(relativePath: string): T {
  const fullPath = resolve(ROOT, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  return yaml.load(raw) as T;
}

export function loadPortfolio(): PortfolioConfig {
  return loadYaml<PortfolioConfig>('portfolio.yaml');
}

export function loadSectors(): SectorsConfig {
  return loadYaml<SectorsConfig>('configs/sectors.yaml');
}

export function loadTokens(): TokensConfig {
  return loadYaml<TokensConfig>('configs/tokens.yaml');
}
