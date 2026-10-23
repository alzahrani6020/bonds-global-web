-- Activate the existing Sensitivity Analysis service on the existing deterministic scenario engine.
UPDATE public.service_execution_profiles sep
SET execution_status = 'automated',
    execution_mode = 'capability_plan',
    primary_action = 'scenario_forecast_run',
    version = sep.version + 1,
    metadata = coalesce(sep.metadata, '{}'::jsonb) || jsonb_build_object(
      'deterministic_financial_engine', true,
      'sensitivity_method', 'one_factor_at_a_time',
      'engine_reuse', 'scenario_forecast_run',
      'financial_data_62_completion', true
    ),
    updated_at = now()
FROM public.service_catalog sc
WHERE sc.id = sep.service_id
  AND sc.code = 'sensitivity_analysis'
  AND sep.is_active = true
  AND (
    sep.execution_status IS DISTINCT FROM 'automated'
    OR sep.execution_mode IS DISTINCT FROM 'capability_plan'
    OR sep.primary_action IS DISTINCT FROM 'scenario_forecast_run'
  );
