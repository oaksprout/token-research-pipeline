export interface Holding {
  symbol: string;
  bucket: 'core' | 'active' | 'constrained';
  current_units: number;
  cost_basis_usd: number;
  pilot_target_pct: number | null;
  scale_target_pct: number | null;
  max_position_pct: number | null;
  thesis: string;
  thesis_status: 'intact' | 'weakening' | 'invalidated';
  invalidation: string;
  execution_exempt: boolean;
  can_add: boolean;
}

export interface PortfolioTargets {
  pilot_default_pct: number;
  scale_default_pct: number;
  max_sectors: number;
  cash_reserve_pct: number;
}

export interface PortfolioConfig {
  last_updated: string;
  holdings: Holding[];
  targets: PortfolioTargets;
}

export interface StructuralFilters {
  novel_capability: boolean;
  capital_pathway: boolean;
  distribution_vector: boolean;
}

export interface MetricsSources {
  tvl_category: string | null;
  coingecko_category: string | null;
  github_repos: string[];
}

export interface SectorDef {
  name: string;
  description: string;
  token_universe: string[];
  structural_filters: StructuralFilters;
  metrics_sources: MetricsSources;
  notes?: string;
}

export interface SectorsConfig {
  sectors: Record<string, SectorDef>;
}

export interface TokenDef {
  name: string;
  sector: string | null;
  coingecko_id: string | null;
  notes: string;
}

export interface TokensConfig {
  tokens: Record<string, TokenDef>;
}
