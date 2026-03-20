import { Injectable } from '@nestjs/common';

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex' | 'exists';
  value: unknown;
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

@Injectable()
export class QueryBuilderService {
  compile(config: QueryConfiguration, injectedFilters?: QueryFilter[]): unknown[] {
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
        pipeline.push({ $unwind: { path: `$${lookup.as}`, preserveNullAndEmptyArrays: true } });
      }
    }

    const allFilters = [
      ...(config.filters ?? []),
      ...(injectedFilters ?? []),
    ];

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
        projectStage[field.replace(/\./g, '_')] = `$_id.${field.replace(/\./g, '_')}`;
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
    switch (filter.operator) {
      case 'eq':
        return filter.value;
      case 'ne':
        return { $ne: filter.value };
      case 'gt':
        return { $gt: filter.value };
      case 'gte':
        return { $gte: filter.value };
      case 'lt':
        return { $lt: filter.value };
      case 'lte':
        return { $lte: filter.value };
      case 'in':
        return { $in: Array.isArray(filter.value) ? filter.value : [filter.value] };
      case 'nin':
        return { $nin: Array.isArray(filter.value) ? filter.value : [filter.value] };
      case 'regex':
        return { $regex: filter.value, $options: 'i' };
      case 'exists':
        return { $exists: Boolean(filter.value) };
      default:
        return filter.value;
    }
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
}
