import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';

export interface QueryFilter {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'regex'
    | 'exists';
  value: unknown;
  fieldType?: string;
}

export interface QueryAggregation {
  field: string;
  function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT';
  alias: string;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryLookup {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
  unwind?: boolean; // $unwind after $lookup to flatten the array
}

export interface QueryConfiguration {
  filters?: QueryFilter[];
  aggregations?: QueryAggregation[];
  groupBy?: string[];
  sort?: QuerySort[];
  limit?: number;
  projections?: string[];
  lookups?: QueryLookup[];
}

// ── Pipeline Configuration (v2) ──

interface PipelineStageBase {
  id: string;
  enabled: boolean;
}

export type MatchStage = PipelineStageBase & {
  type: '$match';
  filters: QueryFilter[];
};

export type LookupStage = PipelineStageBase & {
  type: '$lookup';
  from: string;
  localField: string;
  foreignField: string;
  as: string;
  unwind?: boolean;
};

export type GroupStage = PipelineStageBase & {
  type: '$group';
  groupBy: string[];
  aggregations: QueryAggregation[];
};

export type SortStage = PipelineStageBase & {
  type: '$sort';
  sort: QuerySort[];
};

export type LimitStage = PipelineStageBase & {
  type: '$limit';
  limit: number;
};

export type ProjectStage = PipelineStageBase & {
  type: '$project';
  include: string[];
  exclude?: string[];
};

export type UnwindStage = PipelineStageBase & {
  type: '$unwind';
  path: string;
  preserveNullAndEmptyArrays: boolean;
};

export type PipelineStage =
  | MatchStage
  | LookupStage
  | GroupStage
  | SortStage
  | LimitStage
  | ProjectStage
  | UnwindStage;

export interface PipelineConfiguration {
  version: 2;
  stages: PipelineStage[];
}

export type QueryConfigurationAny = QueryConfiguration | PipelineConfiguration;

export interface FieldSchema {
  name: string;
  type: string;
}

export interface MatchableField {
  name: string;
  type: string;
  origin: 'base' | 'lookup' | 'group';
  stageLabel?: string;
}

interface FieldOrigin {
  type: 'base' | 'lookup' | 'group';
  /** Index in stages array, -1 for base collection fields */
  stageIndex: number;
}

export function isPipelineConfiguration(
  config: unknown,
): config is PipelineConfiguration {
  return (
    typeof config === 'object' &&
    config !== null &&
    (config as PipelineConfiguration).version === 2
  );
}

@Injectable()
export class QueryBuilderService {
  compile(
    config: QueryConfiguration,
    injectedFilters?: QueryFilter[],
  ): unknown[] {
    const pipeline: unknown[] = [];

    // $lookup stages (before filters so joined fields can be filtered)
    for (const lookup of config.lookups ?? []) {
      pipeline.push({
        $lookup: {
          from: lookup.from,
          localField: lookup.localField,
          foreignField: lookup.foreignField,
          as: lookup.as,
        },
      });
      if (lookup.unwind) {
        pipeline.push({
          $unwind: { path: `$${lookup.as}`, preserveNullAndEmptyArrays: true },
        });
      }
    }

    const allFilters = [...(config.filters ?? []), ...(injectedFilters ?? [])];

    // $match stage
    if (allFilters.length > 0) {
      const match = this.buildMatch(allFilters);
      if (Object.keys(match).length > 0) {
        pipeline.push({ $match: match });
      }
    }

    // $group stage (only if aggregations defined)
    if (config.aggregations && config.aggregations.length > 0) {
      const groupId: Record<string, string> = {};
      for (const field of config.groupBy ?? []) {
        groupId[field.replace(/\./g, '_')] = `$${field}`;
      }

      const groupStage: Record<string, unknown> = {
        _id: Object.keys(groupId).length > 0 ? groupId : null,
      };

      for (const agg of config.aggregations) {
        groupStage[agg.alias] = this.buildAggregation(agg);
      }

      pipeline.push({ $group: groupStage });

      // $project after group to flatten _id
      const projectStage: Record<string, unknown> = { _id: 0 };
      for (const field of config.groupBy ?? []) {
        projectStage[field.replace(/\./g, '_')] =
          `$_id.${field.replace(/\./g, '_')}`;
      }
      for (const agg of config.aggregations) {
        projectStage[agg.alias] = 1;
      }
      pipeline.push({ $project: projectStage });
    } else if (config.projections && config.projections.length > 0) {
      const project: Record<string, number> = { _id: 0 };
      for (const field of config.projections) {
        project[field] = 1;
      }
      pipeline.push({ $project: project });
    }

    // $sort stage
    if (config.sort && config.sort.length > 0) {
      const sortStage: Record<string, 1 | -1> = {};
      for (const s of config.sort) {
        sortStage[s.field] = s.direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sortStage });
    }

    // $limit stage
    const limit = config.limit ?? 1000;
    pipeline.push({ $limit: limit });

    return pipeline;
  }

  private buildMatch(filters: QueryFilter[]): Record<string, unknown> {
    const match: Record<string, unknown> = {};
    for (const f of filters) {
      match[f.field] = this.buildCondition(f);
    }
    return match;
  }

  private buildCondition(filter: QueryFilter): unknown {
    const coerce = (v: unknown) => this.coerceValue(v, filter.fieldType);

    switch (filter.operator) {
      case 'eq':
        return coerce(filter.value);
      case 'ne':
        return { $ne: coerce(filter.value) };
      case 'gt':
        return { $gt: coerce(filter.value) };
      case 'gte':
        return { $gte: coerce(filter.value) };
      case 'lt':
        return { $lt: coerce(filter.value) };
      case 'lte':
        return { $lte: coerce(filter.value) };
      case 'in': {
        const arr = Array.isArray(filter.value)
          ? filter.value
          : [filter.value];
        return { $in: arr.map(coerce) };
      }
      case 'nin': {
        const arr = Array.isArray(filter.value)
          ? filter.value
          : [filter.value];
        return { $nin: arr.map(coerce) };
      }
      case 'regex':
        return { $regex: filter.value, $options: 'i' };
      case 'exists':
        return { $exists: Boolean(filter.value) };
      default:
        return coerce(filter.value);
    }
  }

  /**
   * Coerce a value to the appropriate MongoDB type based on fieldType.
   * Handles ObjectId string-to-ObjectId conversion and number coercion.
   */
  private coerceValue(value: unknown, fieldType?: string): unknown {
    if (value === null || value === undefined) return value;

    if (fieldType === 'objectId' && typeof value === 'string') {
      if (/^[0-9a-fA-F]{24}$/.test(value)) {
        return new ObjectId(value);
      }
    }

    if (fieldType === 'number' && typeof value === 'string') {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }

    return value;
  }

  private buildAggregation(agg: QueryAggregation): unknown {
    switch (agg.function) {
      case 'SUM':
        return { $sum: `$${agg.field}` };
      case 'AVG':
        return { $avg: `$${agg.field}` };
      case 'COUNT':
        return { $sum: 1 };
      case 'COUNT_DISTINCT':
        return { $addToSet: `$${agg.field}` };
      case 'MIN':
        return { $min: `$${agg.field}` };
      case 'MAX':
        return { $max: `$${agg.field}` };
    }
  }

  // ── Pipeline v2 compilation ──

  /**
   * Analyzes where a field originates in the pipeline (base collection, $lookup, or $group).
   * Used to determine where to inject $match stages.
   */
  analyzeFieldOrigin(
    config: PipelineConfiguration,
    fieldName: string,
  ): FieldOrigin {
    const enabledStages = config.stages.filter((s) => s.enabled);

    for (let i = 0; i < enabledStages.length; i++) {
      const stage = enabledStages[i];

      // Check if field comes from a $lookup (prefixed with "as.")
      if (stage.type === '$lookup') {
        const prefix = stage.as;
        if (fieldName === prefix || fieldName.startsWith(`${prefix}.`)) {
          return { type: 'lookup', stageIndex: i };
        }
      }

      // Check if field comes from a $group (groupBy key or aggregation alias)
      if (stage.type === '$group') {
        const groupOutputFields = [
          ...stage.groupBy.map((f) => f.replace(/\./g, '_')),
          ...stage.aggregations.map((a) => a.alias),
        ];
        if (groupOutputFields.includes(fieldName)) {
          return { type: 'group', stageIndex: i };
        }
      }
    }

    return { type: 'base', stageIndex: -1 };
  }

  compilePipeline(
    config: PipelineConfiguration,
    injectedFilters?: QueryFilter[],
  ): unknown[] {
    const pipeline: unknown[] = [];
    const enabledStages = config.stages.filter((s) => s.enabled);

    if (!injectedFilters || injectedFilters.length === 0) {
      for (const stage of enabledStages) {
        pipeline.push(...this.compileStage(stage));
      }
      return pipeline;
    }

    // Group injected filters by their insertion point
    const filtersByInsertionPoint = new Map<number, QueryFilter[]>();
    for (const filter of injectedFilters) {
      const origin = this.analyzeFieldOrigin(config, filter.field);
      const insertAfter = origin.stageIndex; // -1 = prepend
      if (!filtersByInsertionPoint.has(insertAfter)) {
        filtersByInsertionPoint.set(insertAfter, []);
      }
      filtersByInsertionPoint.get(insertAfter)!.push(filter);
    }

    // Prepend base-field filters (stageIndex === -1)
    const baseFilters = filtersByInsertionPoint.get(-1);
    if (baseFilters?.length) {
      const match = this.buildMatch(baseFilters);
      if (Object.keys(match).length > 0) pipeline.push({ $match: match });
    }

    // Compile stages, inserting filters after their origin stage
    for (let i = 0; i < enabledStages.length; i++) {
      const stage = enabledStages[i];
      pipeline.push(...this.compileStage(stage));

      // Insert any filters that depend on this stage
      const stageFilters = filtersByInsertionPoint.get(i);
      if (stageFilters?.length) {
        const match = this.buildMatch(stageFilters);
        if (Object.keys(match).length > 0) pipeline.push({ $match: match });
      }
    }

    return pipeline;
  }

  compilePartial(
    config: PipelineConfiguration,
    upToStageId: string,
  ): unknown[] {
    const pipeline: unknown[] = [];

    for (const stage of config.stages) {
      if (!stage.enabled) {
        if (stage.id === upToStageId) break;
        continue;
      }
      pipeline.push(...this.compileStage(stage));
      if (stage.id === upToStageId) break;
    }

    return pipeline;
  }

  compileAny(
    config: QueryConfigurationAny,
    injectedFilters?: QueryFilter[],
  ): unknown[] {
    if (isPipelineConfiguration(config)) {
      return this.compilePipeline(config, injectedFilters);
    }
    return this.compile(config, injectedFilters);
  }

  /**
   * Statically analyzes a query configuration to determine its output fields.
   * Walks pipeline stages in order, tracking how fields change through
   * $lookup, $group, $project, and $unwind stages.
   *
   * @param config The query configuration (v1 or v2)
   * @param baseFields Fields from the base collection
   * @param foreignSchemas Map of collection name → fields for $lookup foreign collections
   */
  getOutputFields(
    config: QueryConfigurationAny,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]> = new Map(),
  ): FieldSchema[] {
    if (isPipelineConfiguration(config)) {
      return this.getOutputFieldsPipeline(config, baseFields, foreignSchemas);
    }
    return this.getOutputFieldsLegacy(
      config,
      baseFields,
      foreignSchemas,
    );
  }

  private getOutputFieldsPipeline(
    config: PipelineConfiguration,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]>,
  ): FieldSchema[] {
    let fields = [...baseFields];

    for (const stage of config.stages) {
      if (!stage.enabled) continue;

      switch (stage.type) {
        case '$lookup': {
          const foreign = foreignSchemas.get(stage.from) ?? [];
          const prefixed = foreign.map((f) => ({
            name: `${stage.as}.${f.name}`,
            type: f.type,
          }));
          fields = [...fields, ...prefixed];
          break;
        }

        case '$unwind':
          // Unwind doesn't change the field set
          break;

        case '$group': {
          // Group replaces all fields with groupBy keys + aggregation aliases
          const groupFields: FieldSchema[] = [
            ...stage.groupBy.map((f) => ({
              name: f.replace(/\./g, '_'),
              type: 'mixed',
            })),
            ...stage.aggregations.map((a) => ({
              name: a.alias,
              type: 'number',
            })),
          ];
          if (groupFields.length > 0) {
            fields = groupFields;
          }
          break;
        }

        case '$project': {
          // Project restricts to included fields only
          const included = new Set(stage.include);
          fields = fields.filter((f) => included.has(f.name));
          break;
        }

        // $match, $sort, $limit don't change the field set
      }
    }

    return fields;
  }

  private getOutputFieldsLegacy(
    config: QueryConfiguration,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]>,
  ): FieldSchema[] {
    let fields = [...baseFields];

    // Lookups add foreign fields
    for (const lookup of config.lookups ?? []) {
      const foreign = foreignSchemas.get(lookup.from) ?? [];
      const prefixed = foreign.map((f) => ({
        name: `${lookup.as}.${f.name}`,
        type: f.type,
      }));
      fields = [...fields, ...prefixed];
    }

    // Group replaces all fields
    if (config.aggregations && config.aggregations.length > 0) {
      fields = [
        ...(config.groupBy ?? []).map((f) => ({
          name: f.replace(/\./g, '_'),
          type: 'mixed',
        })),
        ...config.aggregations.map((a) => ({
          name: a.alias,
          type: 'number',
        })),
      ];
    } else if (config.projections && config.projections.length > 0) {
      const included = new Set(config.projections);
      fields = fields.filter((f) => included.has(f.name));
    }

    return fields;
  }

  /**
   * Returns ALL fields where a $match can be injected at any point in the pipeline.
   * Unlike getOutputFields (which returns only final output), this accumulates fields
   * from every stage so the user can filter on base, lookup, or group fields.
   */
  getMatchableFields(
    config: QueryConfigurationAny,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]> = new Map(),
  ): MatchableField[] {
    if (isPipelineConfiguration(config)) {
      return this.getMatchableFieldsPipeline(config, baseFields, foreignSchemas);
    }
    return this.getMatchableFieldsLegacy(config, baseFields, foreignSchemas);
  }

  private getMatchableFieldsPipeline(
    config: PipelineConfiguration,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]>,
  ): MatchableField[] {
    const result: MatchableField[] = baseFields.map((f) => ({
      name: f.name,
      type: f.type,
      origin: 'base' as const,
      stageLabel: 'Campos base',
    }));

    for (const stage of config.stages) {
      if (!stage.enabled) continue;

      switch (stage.type) {
        case '$lookup': {
          const foreign = foreignSchemas.get(stage.from) ?? [];
          for (const f of foreign) {
            result.push({
              name: `${stage.as}.${f.name}`,
              type: f.type,
              origin: 'lookup',
              stageLabel: `$lookup ${stage.from}`,
            });
          }
          break;
        }

        case '$group': {
          for (const f of stage.groupBy) {
            result.push({
              name: f.replace(/\./g, '_'),
              type: 'mixed',
              origin: 'group',
              stageLabel: '$group',
            });
          }
          for (const a of stage.aggregations) {
            result.push({
              name: a.alias,
              type: 'number',
              origin: 'group',
              stageLabel: '$group',
            });
          }
          break;
        }
      }
    }

    // Deduplicate by name (keep first occurrence)
    const seen = new Set<string>();
    return result.filter((f) => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });
  }

  private getMatchableFieldsLegacy(
    config: QueryConfiguration,
    baseFields: FieldSchema[],
    foreignSchemas: Map<string, FieldSchema[]>,
  ): MatchableField[] {
    const result: MatchableField[] = baseFields.map((f) => ({
      name: f.name,
      type: f.type,
      origin: 'base' as const,
      stageLabel: 'Campos base',
    }));

    for (const lookup of config.lookups ?? []) {
      const foreign = foreignSchemas.get(lookup.from) ?? [];
      for (const f of foreign) {
        result.push({
          name: `${lookup.as}.${f.name}`,
          type: f.type,
          origin: 'lookup',
          stageLabel: `$lookup ${lookup.from}`,
        });
      }
    }

    if (config.aggregations && config.aggregations.length > 0) {
      for (const f of config.groupBy ?? []) {
        result.push({
          name: f.replace(/\./g, '_'),
          type: 'mixed',
          origin: 'group',
          stageLabel: '$group',
        });
      }
      for (const a of config.aggregations) {
        result.push({
          name: a.alias,
          type: 'number',
          origin: 'group',
          stageLabel: '$group',
        });
      }
    }

    const seen = new Set<string>();
    return result.filter((f) => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });
  }

  convertLegacyToPipeline(config: QueryConfiguration): PipelineConfiguration {
    const stages: PipelineStage[] = [];

    // $lookup stages
    for (const lookup of config.lookups ?? []) {
      stages.push({
        id: randomUUID(),
        enabled: true,
        type: '$lookup',
        from: lookup.from,
        localField: lookup.localField,
        foreignField: lookup.foreignField,
        as: lookup.as,
        unwind: lookup.unwind,
      });
    }

    // $match stage
    if (config.filters && config.filters.length > 0) {
      stages.push({
        id: randomUUID(),
        enabled: true,
        type: '$match',
        filters: config.filters,
      });
    }

    // $group stage
    if (config.aggregations && config.aggregations.length > 0) {
      stages.push({
        id: randomUUID(),
        enabled: true,
        type: '$group',
        groupBy: config.groupBy ?? [],
        aggregations: config.aggregations,
      });
    }

    // $project stage (only if no aggregations)
    if (
      config.projections &&
      config.projections.length > 0 &&
      (!config.aggregations || config.aggregations.length === 0)
    ) {
      stages.push({
        id: randomUUID(),
        enabled: true,
        type: '$project',
        include: config.projections,
      });
    }

    // $sort stage
    if (config.sort && config.sort.length > 0) {
      stages.push({
        id: randomUUID(),
        enabled: true,
        type: '$sort',
        sort: config.sort,
      });
    }

    // $limit stage
    stages.push({
      id: randomUUID(),
      enabled: true,
      type: '$limit',
      limit: config.limit ?? 1000,
    });

    return { version: 2, stages };
  }

  private compileStage(stage: PipelineStage): unknown[] {
    switch (stage.type) {
      case '$match': {
        if (stage.filters.length === 0) return [];
        const match = this.buildMatch(stage.filters);
        return Object.keys(match).length > 0 ? [{ $match: match }] : [];
      }

      case '$lookup': {
        const result: unknown[] = [
          {
            $lookup: {
              from: stage.from,
              localField: stage.localField,
              foreignField: stage.foreignField,
              as: stage.as,
            },
          },
        ];
        if (stage.unwind) {
          result.push({
            $unwind: {
              path: `$${stage.as}`,
              preserveNullAndEmptyArrays: true,
            },
          });
        }
        return result;
      }

      case '$group': {
        if (stage.aggregations.length === 0) return [];

        const groupId: Record<string, string> = {};
        for (const field of stage.groupBy) {
          groupId[field.replace(/\./g, '_')] = `$${field}`;
        }

        const groupStage: Record<string, unknown> = {
          _id: Object.keys(groupId).length > 0 ? groupId : null,
        };

        for (const agg of stage.aggregations) {
          groupStage[agg.alias] = this.buildAggregation(agg);
        }

        const result: unknown[] = [{ $group: groupStage }];

        // $project after group to flatten _id
        const projectStage: Record<string, unknown> = { _id: 0 };
        for (const field of stage.groupBy) {
          projectStage[field.replace(/\./g, '_')] =
            `$_id.${field.replace(/\./g, '_')}`;
        }
        for (const agg of stage.aggregations) {
          projectStage[agg.alias] = 1;
        }
        result.push({ $project: projectStage });

        return result;
      }

      case '$sort': {
        if (stage.sort.length === 0) return [];
        const sortStage: Record<string, 1 | -1> = {};
        for (const s of stage.sort) {
          sortStage[s.field] = s.direction === 'asc' ? 1 : -1;
        }
        return [{ $sort: sortStage }];
      }

      case '$limit':
        return [{ $limit: stage.limit }];

      case '$project': {
        const project: Record<string, number> = { _id: 0 };
        for (const field of stage.include) {
          project[field] = 1;
        }
        for (const field of stage.exclude ?? []) {
          project[field] = 0;
        }
        return [{ $project: project }];
      }

      case '$unwind':
        return [
          {
            $unwind: {
              path: `$${stage.path}`,
              preserveNullAndEmptyArrays: stage.preserveNullAndEmptyArrays,
            },
          },
        ];
    }
  }
}
