import { Injectable } from '@nestjs/common';
import {
  isPipelineConfiguration,
  type QueryConfigurationAny,
  type QueryFilter,
  type PipelineConfiguration,
  type PipelineStage,
  type MatchStage,
  type LookupStage,
  type GroupStage,
  type SortStage,
  type LimitStage,
  type ProjectStage,
  type UnwindStage,
} from '../../modules/queries/query-builder.service';

export interface CompiledSQL {
  text: string;
  values: unknown[];
}

/** Escapes a SQL identifier with double quotes */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

@Injectable()
export class PostgreSQLQueryCompilerService {
  static readonly DEFAULT_LIMIT = 100;

  compile(
    config: QueryConfigurationAny,
    injectedFilters?: QueryFilter[],
  ): CompiledSQL {
    if (isPipelineConfiguration(config)) {
      return this.compilePipeline(config, injectedFilters);
    }
    return this.compileLegacy(config, injectedFilters);
  }

  compilePartial(
    config: PipelineConfiguration,
    upToStageId: string,
  ): CompiledSQL {
    const stages: PipelineStage[] = [];
    for (const stage of config.stages) {
      if (!stage.enabled) {
        if (stage.id === upToStageId) break;
        continue;
      }
      stages.push(stage);
      if (stage.id === upToStageId) break;
    }

    const partialConfig: PipelineConfiguration = {
      version: 2,
      stages,
    };
    const result = this.compilePipeline(partialConfig);
    // Enforce preview limit
    return this.applyMaxLimit(result, 1000);
  }

  private compileLegacy(
    config: Exclude<QueryConfigurationAny, PipelineConfiguration>,
    injectedFilters?: QueryFilter[],
  ): CompiledSQL {
    // Convert legacy config to pipeline and compile
    const stages: PipelineStage[] = [];
    let stageId = 0;

    for (const lookup of config.lookups ?? []) {
      stages.push({
        id: `legacy_${stageId++}`,
        enabled: true,
        type: '$lookup',
        from: lookup.from,
        localField: lookup.localField,
        foreignField: lookup.foreignField,
        as: lookup.as,
        unwind: lookup.unwind,
      });
    }

    const allFilters = [...(config.filters ?? []), ...(injectedFilters ?? [])];
    if (allFilters.length > 0) {
      stages.push({
        id: `legacy_${stageId++}`,
        enabled: true,
        type: '$match',
        filters: allFilters,
      });
    }

    if (config.aggregations && config.aggregations.length > 0) {
      stages.push({
        id: `legacy_${stageId++}`,
        enabled: true,
        type: '$group',
        groupBy: config.groupBy ?? [],
        aggregations: config.aggregations,
      });
    } else if (config.projections && config.projections.length > 0) {
      stages.push({
        id: `legacy_${stageId++}`,
        enabled: true,
        type: '$project',
        include: config.projections,
      });
    }

    if (config.sort && config.sort.length > 0) {
      stages.push({
        id: `legacy_${stageId++}`,
        enabled: true,
        type: '$sort',
        sort: config.sort,
      });
    }

    stages.push({
      id: `legacy_${stageId++}`,
      enabled: true,
      type: '$limit',
      limit: config.limit ?? PostgreSQLQueryCompilerService.DEFAULT_LIMIT,
    });

    return this.compilePipeline({ version: 2, stages });
  }

  private compilePipeline(
    config: PipelineConfiguration,
    injectedFilters?: QueryFilter[],
  ): CompiledSQL {
    const enabledStages = config.stages.filter((s) => s.enabled);
    const ctx = new CompilationContext();
    let hasExplicitLimit = false;

    // Insert injected filters as a prepended $match if present
    if (injectedFilters && injectedFilters.length > 0) {
      const prependMatch: MatchStage = {
        id: '__injected__',
        enabled: true,
        type: '$match',
        filters: injectedFilters,
      };
      this.compileStage(prependMatch, ctx);
    }

    for (const stage of enabledStages) {
      if (stage.type === '$limit') hasExplicitLimit = true;
      this.compileStage(stage, ctx);
    }

    if (!hasExplicitLimit) {
      ctx.limitClause = PostgreSQLQueryCompilerService.DEFAULT_LIMIT;
    }

    return ctx.build();
  }

  private compileStage(stage: PipelineStage, ctx: CompilationContext): void {
    switch (stage.type) {
      case '$match':
        return this.compileMatch(stage, ctx);
      case '$lookup':
        return this.compileLookup(stage, ctx);
      case '$group':
        return this.compileGroup(stage, ctx);
      case '$sort':
        return this.compileSort(stage, ctx);
      case '$limit':
        return this.compileLimit(stage, ctx);
      case '$project':
        return this.compileProject(stage, ctx);
      case '$unwind':
        return this.compileUnwind(stage, ctx);
    }
  }

  private compileMatch(stage: MatchStage, ctx: CompilationContext): void {
    if (stage.filters.length === 0) return;

    const conditions: string[] = [];
    for (const filter of stage.filters) {
      const cond = this.compileFilter(filter, ctx);
      if (cond) conditions.push(cond);
    }

    if (conditions.length > 0) {
      // If we're after a GROUP BY, wrap in a new CTE with WHERE
      if (ctx.hasGrouped) {
        ctx.wrapInCTE();
        ctx.whereConditions.push(...conditions);
      } else {
        ctx.whereConditions.push(...conditions);
      }
    }
  }

  private compileFilter(
    filter: QueryFilter,
    ctx: CompilationContext,
  ): string | null {
    const col = ctx.resolveColumn(filter.field);

    switch (filter.operator) {
      case 'eq': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} = ${p}`;
      }
      case 'ne': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} != ${p}`;
      }
      case 'gt': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} > ${p}`;
      }
      case 'gte': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} >= ${p}`;
      }
      case 'lt': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} < ${p}`;
      }
      case 'lte': {
        const p = ctx.addParam(
          this.coerceValue(filter.value, filter.fieldType),
        );
        return `${col} <= ${p}`;
      }
      case 'in': {
        const arr = Array.isArray(filter.value) ? filter.value : [filter.value];
        const p = ctx.addParam(
          arr.map((v) => this.coerceValue(v, filter.fieldType)),
        );
        return `${col} = ANY(${p})`;
      }
      case 'nin': {
        const arr = Array.isArray(filter.value) ? filter.value : [filter.value];
        const p = ctx.addParam(
          arr.map((v) => this.coerceValue(v, filter.fieldType)),
        );
        return `${col} != ALL(${p})`;
      }
      case 'regex': {
        const pattern = this.regexToLike(String(filter.value));
        const p = ctx.addParam(pattern);
        return `${col} ILIKE ${p}`;
      }
      case 'exists':
        return filter.value ? `${col} IS NOT NULL` : `${col} IS NULL`;
      default:
        return null;
    }
  }

  private compileLookup(stage: LookupStage, ctx: CompilationContext): void {
    ctx.wrapInCTE();
    const joinTable = ident(stage.from);
    const alias = ident(stage.as);
    const localCol = ctx.resolveColumn(stage.localField);
    const foreignCol = `${alias}.${ident(stage.foreignField)}`;
    const joinType = stage.unwind ? 'LEFT JOIN' : 'LEFT JOIN';
    ctx.joins.push(
      `${joinType} ${joinTable} AS ${alias} ON ${localCol} = ${foreignCol}`,
    );
  }

  private compileGroup(stage: GroupStage, ctx: CompilationContext): void {
    if (stage.aggregations.length === 0) return;

    ctx.wrapInCTE();

    const selectCols: string[] = [];
    const groupByCols: string[] = [];

    for (const field of stage.groupBy) {
      const col = ctx.resolveColumn(field);
      const alias = field.replace(/\./g, '_');
      selectCols.push(`${col} AS ${ident(alias)}`);
      groupByCols.push(col);
    }

    for (const agg of stage.aggregations) {
      const expr = this.compileAggregation(agg.function, agg.field, ctx);
      selectCols.push(`${expr} AS ${ident(agg.alias)}`);
    }

    ctx.selectColumns = selectCols;
    ctx.groupByColumns = groupByCols;
    ctx.hasGrouped = true;
  }

  private compileAggregation(
    fn: string,
    field: string,
    ctx: CompilationContext,
  ): string {
    const col = ctx.resolveColumn(field);
    switch (fn) {
      case 'SUM':
        return `SUM(${col})`;
      case 'AVG':
        return `AVG(${col})`;
      case 'COUNT':
        return 'COUNT(*)';
      case 'COUNT_DISTINCT':
        return `COUNT(DISTINCT ${col})`;
      case 'MIN':
        return `MIN(${col})`;
      case 'MAX':
        return `MAX(${col})`;
      default:
        return `COUNT(*)`;
    }
  }

  private compileSort(stage: SortStage, ctx: CompilationContext): void {
    for (const s of stage.sort) {
      const col = ctx.resolveColumn(s.field);
      const dir = s.direction === 'desc' ? 'DESC' : 'ASC';
      ctx.orderByColumns.push(`${col} ${dir}`);
    }
  }

  private compileLimit(stage: LimitStage, ctx: CompilationContext): void {
    ctx.limitClause = stage.limit;
  }

  private compileProject(stage: ProjectStage, ctx: CompilationContext): void {
    if (stage.include.length === 0) return;
    ctx.wrapInCTE();
    ctx.selectColumns = stage.include.map((f) => ctx.resolveColumn(f));
  }

  private compileUnwind(stage: UnwindStage, ctx: CompilationContext): void {
    ctx.wrapInCTE();
    const col = ctx.resolveColumn(stage.path);
    const alias = ident(`${stage.path}_unnested`);
    const joinType = stage.preserveNullAndEmptyArrays
      ? 'LEFT JOIN LATERAL'
      : 'CROSS JOIN LATERAL';
    ctx.joins.push(`${joinType} unnest(${col}) AS ${alias} ON true`);
  }

  private coerceValue(value: unknown, fieldType?: string): unknown {
    if (value === null || value === undefined) return value;

    if (fieldType === 'number' && typeof value === 'string') {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }

    return value;
  }

  private regexToLike(pattern: string): string {
    // Convert common regex patterns to LIKE/ILIKE
    let like = pattern;
    like = like.replace(/^\.\*/, '%');
    like = like.replace(/\.\*$/, '%');
    like = like.replace(/\./g, '_');
    // If no wildcards were added, wrap in %
    if (!like.includes('%')) {
      like = `%${like}%`;
    }
    return like;
  }

  private applyMaxLimit(sql: CompiledSQL, maxLimit: number): CompiledSQL {
    // If the query already has a LIMIT, don't override
    if (/\bLIMIT\s+\d+/i.test(sql.text)) return sql;
    return {
      text: `${sql.text} LIMIT ${maxLimit}`,
      values: sql.values,
    };
  }
}

/**
 * Mutable compilation context that accumulates SQL clauses as stages are processed.
 */
class CompilationContext {
  private params: unknown[] = [];
  private cteCount = 0;
  private ctes: string[] = [];

  /** The current "source" — either the base table or the latest CTE name */
  currentSource = '';
  selectColumns: string[] = [];
  whereConditions: string[] = [];
  joins: string[] = [];
  groupByColumns: string[] = [];
  orderByColumns: string[] = [];
  limitClause: number | null = null;
  hasGrouped = false;

  addParam(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  resolveColumn(field: string): string {
    // Handle dot-notation for joined fields (e.g., "alias.field")
    const parts = field.split('.');
    if (parts.length === 2) {
      return `${ident(parts[0])}.${ident(parts[1])}`;
    }
    return ident(field);
  }

  /**
   * Wraps the current accumulated query as a CTE, resetting state for the next stage.
   * This is called before stages that need a fresh SELECT context (GROUP, JOIN, PROJECT).
   */
  wrapInCTE(): void {
    // Only wrap if there's accumulated state to wrap
    if (
      this.currentSource === '' &&
      this.whereConditions.length === 0 &&
      this.joins.length === 0 &&
      this.selectColumns.length === 0 &&
      this.groupByColumns.length === 0
    ) {
      return;
    }

    // If there's no source yet, nothing to wrap
    if (this.currentSource === '') return;

    const cteName = `stage_${this.cteCount++}`;
    const sql = this.buildSelect();
    this.ctes.push(`${ident(cteName)} AS (\n${sql}\n)`);

    // Reset state
    this.currentSource = cteName;
    this.selectColumns = [];
    this.whereConditions = [];
    this.joins = [];
    this.groupByColumns = [];
    this.hasGrouped = false;
  }

  private buildSelect(): string {
    const select =
      this.selectColumns.length > 0 ? this.selectColumns.join(', ') : '*';
    const parts: string[] = [
      `SELECT ${select}`,
      `FROM ${ident(this.currentSource)}`,
    ];

    for (const join of this.joins) {
      parts.push(join);
    }

    if (this.whereConditions.length > 0) {
      parts.push(`WHERE ${this.whereConditions.join(' AND ')}`);
    }

    if (this.groupByColumns.length > 0) {
      parts.push(`GROUP BY ${this.groupByColumns.join(', ')}`);
    }

    return parts.join('\n');
  }

  build(): CompiledSQL {
    const finalSelect = this.buildSelect();
    const parts: string[] = [];

    if (this.ctes.length > 0) {
      parts.push(`WITH ${this.ctes.join(',\n')}`);
    }

    parts.push(finalSelect);

    if (this.orderByColumns.length > 0) {
      parts.push(`ORDER BY ${this.orderByColumns.join(', ')}`);
    }

    if (this.limitClause !== null) {
      parts.push(`LIMIT ${this.limitClause}`);
    }

    return {
      text: parts.join('\n'),
      values: this.params,
    };
  }

  setBaseTable(table: string): void {
    this.currentSource = table;
  }
}

// Re-export for use by the adapter
export { CompilationContext };
