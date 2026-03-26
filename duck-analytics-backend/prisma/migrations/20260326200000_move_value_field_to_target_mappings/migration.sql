-- Copy valueField into each targetMappings entry before dropping the column
UPDATE dashboard_filters
SET target_mappings = (
  SELECT jsonb_agg(
    elem || jsonb_build_object('valueField', value_field)
  )
  FROM jsonb_array_elements(target_mappings) AS elem
)
WHERE value_field IS NOT NULL
  AND jsonb_array_length(target_mappings) > 0;

-- AlterTable
ALTER TABLE "dashboard_filters" DROP COLUMN "value_field";
