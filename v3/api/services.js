'use strict';

const { resolveGeoContext } = require('../../lib/geo/resolve-context');
const { executeService, loadExecutionProfile } = require('../../lib/services/service-execution-router');
const { parseDocument, DocumentParserError } = require('../../lib/api/document-parser');
const {
  parseNumeric,
  ALL_FIELDS,
  requirementsFor,
  extractFinancialFields,
  validateDataset,
  classifyDocumentType,
  fieldConfidenceMap,
  qualityStatus,
  stableInputHash,
  buildDependencyGraph
} = require('../../lib/finance/financial-data-intake');
const crypto = require('crypto');
const XLSX = require('xlsx');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function sendBinary(res, status, contentType, filename, buffer) {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'attachment; filename="' + String(filename || 'export').replace(/[^A-Za-z0-9._-]/g, '_') + '"');
  res.setHeader('Content-Length', String(buffer.length));
  res.end(buffer);
}

function executiveSummaryForDataset(dataset) {
  const metrics = dataset.derived_metrics && typeof dataset.derived_metrics === 'object'
    ? dataset.derived_metrics
    : {};
  return {
    title: 'BONDS Financial Analysis Executive Summary',
    dataset_id: dataset.id,
    dataset_version: dataset.dataset_version || 1,
    service_code: dataset.decision_record?.service_code || dataset.service_code,
    quality_status: dataset.quality_status,
    approval_status: dataset.approval_status,
    status: dataset.status,
    is_stale: Boolean(dataset.is_stale),
    source_file: dataset.source_file_name || null,
    source_file_version: dataset.source_file_version || null,
    key_metrics: metrics,
    validation: dataset.validation || {},
    generated_from_approved_result: dataset.approval_status === 'approved',
    generated_at: new Date().toISOString()
  };
}

function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(summary) {
  const lines = [
    summary.title,
    'Dataset: ' + summary.dataset_id,
    'Version: ' + summary.dataset_version,
    'Service: ' + (summary.service_code || 'unknown'),
    'Quality: ' + (summary.quality_status || 'unknown'),
    'Approval: ' + (summary.approval_status || 'unknown'),
    'Status: ' + (summary.status || 'unknown'),
    'Stale: ' + String(summary.is_stale),
    'Source: ' + (summary.source_file || 'manual'),
    'Source version: ' + (summary.source_file_version || 'n/a'),
    'Metrics:',
    ...Object.entries(summary.key_metrics || {}).slice(0, 28).map(([key,value]) =>
      '  ' + key + ': ' + (typeof value === 'object' ? JSON.stringify(value).slice(0, 120) : String(value))
    )
  ].slice(0, 44);
  const text = ['BT','/F1 10 Tf','50 800 Td']
    .concat(lines.flatMap((line,index)=>[
      '(' + pdfEscape(line).replace(/[^\x20-\x7E]/g, '?') + ') Tj',
      index < lines.length - 1 ? '0 -16 Td' : ''
    ]).filter(Boolean))
    .concat(['ET']).join('\n');
  const stream = Buffer.from(text, 'ascii');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + text + '\nendstream'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object,index)=>{
    offsets[index+1]=Buffer.byteLength(pdf,'ascii');
    pdf += (index+1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = Buffer.byteLength(pdf,'ascii');
  pdf += 'xref\n0 ' + (objects.length+1) + '\n0000000000 65535 f \n';
  for(let i=1;i<=objects.length;i++) pdf += String(offsets[i]).padStart(10,'0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + (objects.length+1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(pdf,'ascii');
}

function getQuery(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

async function listPublishedServices(supabase, filters = {}) {
  const { data: services, error } = await supabase
    .from('service_catalog')
    .select('id,code,category_code,group_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,sort_order,default_route_ar,default_route_en,metadata')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;

  let allowed = new Set((services || []).map(row => row.id));
  const intersect = ids => {
    const next = new Set(ids || []);
    allowed = new Set([...allowed].filter(id => next.has(id)));
  };

  if (filters.goal) {
    const { data, error: mapError } = await supabase.from('service_goal_map').select('service_id').eq('goal_code', filters.goal);
    if (mapError) throw mapError;
    intersect((data || []).map(row => row.service_id));
  }

  const allServiceIds=(services||[]).map(row=>row.id);

  if (filters.country && allServiceIds.length) {
    const { data, error: mapError } = await supabase
      .from('service_country_map')
      .select('service_id,country_code,availability_status')
      .eq('country_code', filters.country)
      .in('service_id', allServiceIds);
    if (mapError) throw mapError;
    const unavailable=new Set((data||[]).filter(row=>row.availability_status==='unavailable').map(row=>row.service_id));
    allowed=new Set([...allowed].filter(id=>!unavailable.has(id)));
  }

  if (filters.sector && allServiceIds.length) {
    const { data, error: mapError } = await supabase
      .from('service_sector_map')
      .select('service_id,sector_code')
      .in('service_id', allServiceIds);
    if (mapError) throw mapError;
    const mapped=new Set((data||[]).map(row=>row.service_id));
    const matching=new Set((data||[]).filter(row=>row.sector_code===filters.sector).map(row=>row.service_id));
    allowed=new Set([...allowed].filter(id=>!mapped.has(id)||matching.has(id)));
  }

  if (filters.activity && allServiceIds.length) {
    const { data: activity, error: activityError } = await supabase
      .from('canonical_activities')
      .select('id')
      .eq('code', filters.activity)
      .maybeSingle();
    if (activityError) throw activityError;
    if (activity?.id) {
      const { data, error: mapError } = await supabase
        .from('service_activity_map')
        .select('service_id,canonical_activity_id')
        .in('service_id', allServiceIds);
      if (mapError) throw mapError;
      const mapped=new Set((data||[]).map(row=>row.service_id));
      const matching=new Set((data||[]).filter(row=>row.canonical_activity_id===activity.id).map(row=>row.service_id));
      allowed=new Set([...allowed].filter(id=>!mapped.has(id)||matching.has(id)));
    }
  }

  const selected = (services || []).filter(row => allowed.has(row.id));
  const ids = selected.map(row => row.id);
  if (!ids.length) return [];

  const [capRes, goalRes, countryRes] = await Promise.all([
    supabase.from('service_capability_map').select('service_id,capability_code,run_order,is_required').in('service_id', ids).order('run_order'),
    supabase.from('service_goal_map').select('service_id,goal_code,priority').in('service_id', ids),
    filters.country
      ? supabase.from('service_country_map').select('service_id,country_code,availability_status,availability_reason_ar,availability_reason_en,priority').eq('country_code', filters.country).in('service_id', ids)
      : Promise.resolve({ data: [], error: null })
  ]);
  const failed = [capRes, goalRes, countryRes].find(x => x.error);
  if (failed?.error) throw failed.error;

  const caps = new Map();
  for (const row of capRes.data || []) {
    if (!caps.has(row.service_id)) caps.set(row.service_id, []);
    caps.get(row.service_id).push(row);
  }
  const goals = new Map();
  for (const row of goalRes.data || []) {
    if (!goals.has(row.service_id)) goals.set(row.service_id, []);
    goals.get(row.service_id).push(row);
  }
  const country = new Map((countryRes.data || []).map(row => [row.service_id, row]));

  return selected.map(row => ({
    ...row,
    goals: goals.get(row.id) || [],
    capabilities: caps.get(row.id) || [],
    country: country.get(row.id) || (filters.country ? {
      country_code: filters.country,
      availability_status: 'unknown',
      availability_reason_ar: null,
      availability_reason_en: null,
      priority: 100
    } : null)
  }));
}

async function handleServiceCatalog(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const filters = {
    country: (url.searchParams.get('country') || '').toUpperCase() || null,
    sector: url.searchParams.get('sector') || null,
    activity: url.searchParams.get('activity') || null,
    goal: url.searchParams.get('goal') || null
  };
  try {
    const services = await listPublishedServices(supabase, filters);
    const serviceGroupCodes = [...new Set(services.map(row => row.group_code).filter(Boolean))];
    const serviceCategoryCodes = [...new Set(services.map(row => row.category_code).filter(Boolean))];

    const [groupsRes, categoriesRes] = await Promise.all([
      serviceGroupCodes.length
        ? supabase
            .from('service_groups')
            .select('code,category_code,name_ar,name_en,description_ar,description_en,sort_order,metadata')
            .in('code', serviceGroupCodes)
            .eq('is_active', true)
            .order('sort_order')
        : Promise.resolve({ data: [], error: null }),
      serviceCategoryCodes.length
        ? supabase
            .from('service_categories')
            .select('code,name_ar,name_en,description,sort_order,metadata')
            .in('code', serviceCategoryCodes)
            .eq('is_active', true)
            .order('sort_order')
        : Promise.resolve({ data: [], error: null })
    ]);

    const hierarchyError = groupsRes.error || categoriesRes.error;
    if (hierarchyError) throw hierarchyError;

    return sendJson(res, 200, {
      services,
      groups: groupsRes.data || [],
      categories: categoriesRes.data || [],
      filters,
      count: services.length
    });
  } catch (err) {
    console.error('[services/catalog]', err.message);
    return sendJson(res, 500, { error: 'Failed to load services' });
  }
}

async function handleServiceGoals(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const { data, error } = await supabase
    .from('service_goals')
    .select('code,name_ar,name_en,description,sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return sendJson(res, 500, { error: 'Failed to load service goals' });
  return sendJson(res, 200, { goals: data || [], count: (data || []).length });
}

async function handleServicePackages(req, res, supabase) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const { data: packages, error } = await supabase
    .from('service_packages')
    .select('id,code,name_ar,name_en,description_ar,description_en,sort_order')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return sendJson(res, 500, { error: 'Failed to load service packages' });
  const ids = (packages || []).map(row => row.id);
  let items = [];
  if (ids.length) {
    const { data, error: itemsError } = await supabase
      .from('service_package_items')
      .select('package_id,service_id,sort_order,is_required')
      .in('package_id', ids)
      .order('sort_order');
    if (itemsError) return sendJson(res, 500, { error: 'Failed to load package items' });
    items = data || [];
  }
  return sendJson(res, 200, {
    packages: (packages || []).map(pkg => ({ ...pkg, items: items.filter(item => item.package_id === pkg.id) }))
  });
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_048_576) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

const FINANCIAL_INTAKE_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
]);

function cleanFinancialManualValues(values, fields) {
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const out = {};
  const reviewFields = [];
  const acceptedFields = [...new Set([
    ...(Array.isArray(fields) ? fields : []),
    ...Object.keys(source).filter(field => ALL_FIELDS.includes(field))
  ])];
  for (const field of acceptedFields) {
    const raw = source[field];
    const structured = field === 'periods';
    const value = structured
      ? (Array.isArray(raw) && raw.length ? raw : null)
      : parseNumeric(raw);
    if (value !== null) out[field] = value;
    reviewFields.push({
      field,
      value,
      status: value === null ? 'missing' : 'manual',
      candidates: [],
      currency: null,
      period: null,
      confidence: value === null ? 0 : 1,
      source: value === null ? [] : [{ extraction_method: 'manual_input' }]
    });
  }
  return { values: out, fields: reviewFields };
}

async function resolveFinancialIntakeProfile(supabase, serviceCode) {
  const resolved = await loadExecutionProfile(supabase, serviceCode);
  if (!resolved) return { error: 'SERVICE_NOT_FOUND', httpStatus: 404 };
  const requirements = requirementsFor({
    primaryAction: resolved.profile.primary_action,
    serviceCode,
    values: {}
  });
  if (!requirements.supported) {
    return { error: 'FINANCIAL_INTAKE_NOT_SUPPORTED', httpStatus: 422 };
  }
  return { resolved, requirements };
}

async function handleFinancialIntakePrepare(req, res, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  let body;
  try { body = await parseJsonBody(req); }
  catch (err) { return sendJson(res, 400, { error: 'Invalid JSON body', detail: err.message }); }

  const serviceCode = String(body.service_code || '').trim();
  if (!serviceCode) return sendJson(res, 400, { error: 'service_code is required' });

  const profileState = await resolveFinancialIntakeProfile(supabase, serviceCode);
  if (profileState.error) {
    return sendJson(res, profileState.httpStatus, { ok: false, error: { code: profileState.error } });
  }

  const primaryAction = profileState.resolved.profile.primary_action;
  const hasFile = Boolean(String(body.storage_path || '').trim());
  const hasManual = Boolean(body.manual_values && typeof body.manual_values === 'object' && !Array.isArray(body.manual_values));
  const sourceType = hasFile && hasManual ? 'mixed' : hasFile ? 'file' : 'manual';
  let extracted;
  let documentType = 'unknown';

  const source = {
    type: sourceType,
    file_name: null,
    storage_path: null,
    file_version: null,
    mime_type: null
  };

  if (hasFile) {
    const storagePath = String(body.storage_path || '').trim();
    const requiredPrefix = 'financial-intake/' + user.id + '/';
    if (!storagePath.startsWith(requiredPrefix) || storagePath.includes('..') || storagePath.includes('\\')) {
      return sendJson(res, 403, { ok: false, error: { code: 'FINANCIAL_FILE_PATH_FORBIDDEN' } });
    }

    const mime = String(body.mime_type || '').toLowerCase().split(';', 1)[0].trim();
    if (!FINANCIAL_INTAKE_MIME.has(mime)) {
      return sendJson(res, 415, { ok: false, error: { code: 'FINANCIAL_FILE_TYPE_UNSUPPORTED' } });
    }

    const declaredSize = Number(body.size_bytes);
    if (Number.isFinite(declaredSize) && declaredSize > 10 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: { code: 'FINANCIAL_FILE_TOO_LARGE' } });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from('client-documents')
      .download(storagePath);
    if (downloadError || !blob) {
      return sendJson(res, 404, { ok: false, error: { code: 'FINANCIAL_FILE_NOT_FOUND' } });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: { code: 'FINANCIAL_FILE_TOO_LARGE' } });
    }

    let parsed;
    try {
      parsed = await parseDocument({
        buffer,
        mime,
        filename: String(body.file_name || 'financial-document').slice(0, 255)
      });
    } catch (error) {
      const code = error instanceof DocumentParserError ? error.code : 'PARSER_FAILED';
      return sendJson(res, 422, { ok: false, error: { code } });
    }

    documentType = classifyDocumentType(parsed);
    extracted = extractFinancialFields({ parsed, primaryAction, serviceCode });

    source.file_name = String(body.file_name || 'financial-document').slice(0, 255);
    source.storage_path = storagePath;
    source.file_version = 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
    source.mime_type = mime;

    if (hasManual) {
      const manual = cleanFinancialManualValues(body.manual_values, profileState.requirements.requirement_fields);
      const fieldMap = new Map((extracted.fields || []).map(field => [field.field, field]));
      for (const manualField of manual.fields.filter(field => field.value !== null)) {
        const current = fieldMap.get(manualField.field);
        if (!current || current.status === 'missing') {
          extracted.values[manualField.field] = manualField.value;
          const replacement = { ...manualField };
          if (current) Object.assign(current, replacement);
          else {
            extracted.fields.push(replacement);
            fieldMap.set(replacement.field, replacement);
          }
          continue;
        }
        if (current.value === manualField.value && !['conflict','multi_period'].includes(current.status)) {
          current.source = [...(current.source || []), ...manualField.source];
          current.confidence = 1;
          continue;
        }
        delete extracted.values[manualField.field];
        current.status = 'conflict';
        current.candidates = [
          ...(current.candidates || []),
          { value: current.value, period: current.period || null, source: 'file' },
          { value: manualField.value, period: null, source: 'manual' }
        ];
        current.value = null;
        current.confidence = 0;
        current.source = [...(current.source || []), ...manualField.source];
      }
      extracted.validation = validateDataset({
        primaryAction,
        serviceCode,
        values: extracted.values,
        fields: extracted.fields
      });
    }
  } else {
    const manual = cleanFinancialManualValues(
      body.manual_values,
      profileState.requirements.requirement_fields
    );
    extracted = {
      ...profileState.requirements,
      values: manual.values,
      fields: manual.fields,
      provenance: Object.fromEntries(
        manual.fields.filter(field => field.value !== null).map(field => [field.field, field.source])
      )
    };
    extracted.validation = validateDataset({
      primaryAction,
      serviceCode,
      values: manual.values,
      fields: manual.fields
    });
  }

  const inputHash = stableInputHash(extracted.values || {});
  const confidence = fieldConfidenceMap(extracted.fields || []);
  const qStatus = qualityStatus({ validation: extracted.validation, fields: extracted.fields, reviewed: false });
  const dependencyGraph = buildDependencyGraph({
    requirementFields: extracted.requirement_fields || [],
    serviceCode,
    engineCode: extracted.engine_code || null
  });

  let parentDataset = null;
  const parentDatasetId = String(body.parent_dataset_id || '').trim() || null;
  if (parentDatasetId) {
    const { data, error } = await supabase
      .from('financial_datasets')
      .select('id,dataset_version,reviewed_values,input_hash')
      .eq('id', parentDatasetId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) return sendJson(res, 404, { ok:false, error:{ code:'FINANCIAL_PARENT_DATASET_NOT_FOUND' } });
    parentDataset = data;
  }

  const { data: duplicate } = await supabase
    .from('financial_datasets')
    .select('id,dataset_version')
    .eq('user_id', user.id)
    .eq('input_hash', inputHash)
    .is('deleted_at', null)
    .order('created_at', { ascending:false })
    .limit(1)
    .maybeSingle();

  const parentValues = parentDataset?.reviewed_values || {};
  const currentValues = extracted.values || {};
  const changedKeys = [...new Set([...Object.keys(parentValues), ...Object.keys(currentValues)])]
    .filter(key => JSON.stringify(parentValues[key]) !== JSON.stringify(currentValues[key]));
  const changeDetection = parentDataset ? {
    baseline_dataset_id: parentDataset.id,
    baseline_dataset_version: parentDataset.dataset_version || 1,
    baseline_input_hash: parentDataset.input_hash || null,
    input_hash_changed: parentDataset.input_hash !== inputHash,
    changed_fields: changedKeys.map(field => {
      const previous = parentValues[field] ?? null;
      const current = currentValues[field] ?? null;
      const numeric = Number.isFinite(Number(previous)) && Number.isFinite(Number(current));
      const absolute = numeric ? Number(current) - Number(previous) : null;
      const pct = numeric && Number(previous) !== 0 ? (absolute / Math.abs(Number(previous))) * 100 : null;
      return { field, previous, current, absolute_change:absolute, pct_change:pct };
    })
  } : null;

  const now = new Date().toISOString();
  const provenanceEnvelope = {
    source,
    fields: extracted.fields || [],
    extracted_at: now,
    extraction_scope: extracted.requirement_fields || [],
    extraction_method: sourceType === 'file' ? 'existing_document_parser' : sourceType === 'mixed' ? 'existing_document_parser+manual_input' : 'manual_input'
  };

  const row = {
    user_id: user.id,
    client_id: body.client_id || null,
    project_id: body.project_id || null,
    service_code: serviceCode,
    source_type: sourceType,
    source_file_name: source.file_name,
    source_storage_path: source.storage_path,
    source_file_version: source.file_version,
    source_mime_type: source.mime_type,
    document_type: documentType,
    extracted_values: extracted.values || {},
    reviewed_values: extracted.values || {},
    field_provenance: provenanceEnvelope,
    field_confidence: confidence,
    validation: extracted.validation || {},
    quality_status: qStatus,
    overrides: [],
    status: 'draft',
    approval_status: 'draft',
    input_hash: inputHash,
    input_snapshot: {},
    dependency_graph: dependencyGraph,
    evidence_pack: {
      source: { type: source.type, file_name: source.file_name, file_version: source.file_version, mime_type: source.mime_type },
      validation: extracted.validation || {},
      field_confidence: confidence,
      document_type: documentType,
      historical_baseline: parentDataset ? {
        dataset_id:parentDataset.id,
        dataset_version:parentDataset.dataset_version || 1,
        input_hash:parentDataset.input_hash || null
      } : null,
      change_detection: changeDetection
    },
    dataset_version: parentDataset ? Number(parentDataset.dataset_version || 1) + 1 : 1,
    parent_dataset_id: parentDataset?.id || null,
    duplicate_of_id: duplicate?.id || null,
    updated_at: now
  };

  const { data: dataset, error: insertError } = await supabase
    .from('financial_datasets')
    .insert(row)
    .select('id,service_code,source_type,source_file_name,source_file_version,document_type,quality_status,dataset_version,parent_dataset_id,duplicate_of_id,extracted_values,reviewed_values,field_provenance,field_confidence,validation,status,approval_status,created_at')
    .single();

  if (insertError) {
    console.error('[services/intake/prepare]', insertError.message);
    return sendJson(res, 500, { ok: false, error: { code: 'FINANCIAL_DATASET_CREATE_FAILED' } });
  }

  if (parentDataset?.id) {
    await supabase.from('financial_datasets').update({
      is_stale: true,
      stale_reason: 'superseded_by_dataset_version:' + dataset.id,
      updated_at: now
    }).eq('id', parentDataset.id).eq('user_id', user.id);
  }

  return sendJson(res, 201, {
    ok: true,
    dataset_id: dataset.id,
    service_code: serviceCode,
    required_fields: extracted.requirement_fields || [],
    fields: extracted.fields || [],
    field_confidence: confidence,
    missing_fields: extracted.validation?.missing || [],
    validation: extracted.validation || {},
    quality_status: qStatus,
    document_type: documentType,
    dataset_version: dataset.dataset_version,
    duplicate_of_id: dataset.duplicate_of_id,
    source: { type: source.type, file_name: source.file_name, file_version: source.file_version, mime_type: source.mime_type },
    status: dataset.status,
    approval_status: dataset.approval_status
  });
}

async function handleFinancialIntakeApprove(req, res, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  let body;
  try { body = await parseJsonBody(req); }
  catch (err) { return sendJson(res, 400, { error: 'Invalid JSON body', detail: err.message }); }

  const datasetId = String(body.dataset_id || '').trim();
  if (!datasetId) return sendJson(res, 400, { error: 'dataset_id is required' });

  const { data: dataset, error: readError } = await supabase
    .from('financial_datasets')
    .select('*')
    .eq('id', datasetId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError || !dataset) return sendJson(res, 404, { ok: false, error: { code: 'FINANCIAL_DATASET_NOT_FOUND' } });

  const profileState = await resolveFinancialIntakeProfile(supabase, dataset.service_code);
  if (profileState.error) {
    return sendJson(res, profileState.httpStatus, { ok: false, error: { code: profileState.error } });
  }

  const corrections = body.corrections && typeof body.corrections === 'object' && !Array.isArray(body.corrections)
    ? body.corrections
    : {};
  const reviewed = { ...(dataset.reviewed_values || {}) };
  const fields = Array.isArray(dataset.field_provenance?.fields)
    ? dataset.field_provenance.fields.map(field => ({ ...field, source: Array.isArray(field.source) ? [...field.source] : [] }))
    : [];
  const fieldMap = new Map(fields.map(field => [field.field, field]));
  const overrides = Array.isArray(dataset.overrides) ? [...dataset.overrides] : [];
  const now = new Date().toISOString();
  let valuesChanged = false;

  for (const field of profileState.requirements.requirement_fields) {
    if (!Object.prototype.hasOwnProperty.call(corrections, field)) continue;
    const rawCorrection = corrections[field];
    const value = field === 'periods'
      ? (Array.isArray(rawCorrection) && rawCorrection.length ? rawCorrection : null)
      : parseNumeric(rawCorrection);
    if (value === null) {
      if (Object.prototype.hasOwnProperty.call(reviewed, field)) valuesChanged = true;
      delete reviewed[field];
      continue;
    }
    const previous = Object.prototype.hasOwnProperty.call(reviewed, field) ? reviewed[field] : null;
    reviewed[field] = value;
    if (JSON.stringify(previous) !== JSON.stringify(value)) {
      valuesChanged = true;
      overrides.push({
        field,
        original_extracted_value: Object.prototype.hasOwnProperty.call(dataset.extracted_values || {}, field)
          ? dataset.extracted_values[field]
          : null,
        previous_reviewed_value: previous,
        corrected_value: value,
        method: 'manual_review',
        at: now
      });
    }
    const current = fieldMap.get(field) || {
      field, value:null, status:'missing', candidates:[], currency:null, period:null, confidence:0, source:[]
    };
    current.value = value;
    current.status = 'corrected';
    current.candidates = [];
    current.confidence = 1;
    current.source = [...current.source, { extraction_method: 'manual_review', at: now }];
    if (!fieldMap.has(field)) {
      fields.push(current);
      fieldMap.set(field, current);
    }
  }

  const validation = validateDataset({
    primaryAction: profileState.resolved.profile.primary_action,
    serviceCode: dataset.service_code,
    values: reviewed,
    fields
  });
  const status = validation.valid ? 'validated' : 'reviewed';
  const approvalStatus = validation.valid ? 'approved' : 'reviewed';
  const confidence = fieldConfidenceMap(fields);
  const qStatus = qualityStatus({ validation, fields, reviewed:true });
  const inputHash = stableInputHash(reviewed);
  const previousHistory = Array.isArray(dataset.execution_history) ? dataset.execution_history : [];
  const executionHistory = valuesChanged
    ? previousHistory.map(entry=>({ ...entry, stale:true, stale_reason:'dataset_values_changed', stale_at:now }))
    : previousHistory;
  const provenance = {
    ...(dataset.field_provenance || {}),
    fields,
    reviewed_at: now
  };
  const inputSnapshot = validation.valid ? {
    dataset_id:dataset.id,
    dataset_version:dataset.dataset_version || 1,
    values:{...reviewed},
    input_hash:inputHash,
    approved_at:now
  } : {};

  const { error: updateError } = await supabase
    .from('financial_datasets')
    .update({
      reviewed_values: reviewed,
      field_provenance: provenance,
      field_confidence: confidence,
      validation,
      quality_status: qStatus,
      overrides,
      status,
      approval_status: approvalStatus,
      input_hash: inputHash,
      input_snapshot: inputSnapshot,
      execution_history: executionHistory,
      is_stale: valuesChanged && previousHistory.length > 0,
      stale_reason: valuesChanged && previousHistory.length > 0 ? 'dataset_values_changed' : dataset.stale_reason,
      evidence_pack: {
        ...(dataset.evidence_pack || {}),
        validation,
        field_confidence:confidence,
        reviewed_at:now,
        override_count:overrides.length
      },
      updated_at: now
    })
    .eq('id', dataset.id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[services/intake/approve]', updateError.message);
    return sendJson(res, 500, { ok: false, error: { code: 'FINANCIAL_DATASET_UPDATE_FAILED' } });
  }

  return sendJson(res, validation.valid ? 200 : 422, {
    ok: validation.valid,
    dataset_id: dataset.id,
    service_code: dataset.service_code,
    status,
    approval_status: approvalStatus,
    quality_status:qStatus,
    values: reviewed,
    fields,
    field_confidence:confidence,
    missing_fields: validation.missing || [],
    warnings: validation.warnings || [],
    errors: validation.errors || [],
    validation
  });
}

async function handleServiceExecute(req, res, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = await parseJsonBody(req); }
  catch (err) { return sendJson(res, 400, { error: 'Invalid JSON body', detail: err.message }); }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: 'Invalid request body' });
  }

  const serviceCode = String(body.service_code || '').trim();
  if (!serviceCode) return sendJson(res, 400, { error: 'service_code is required' });

  let dataset = null;
  let targetValidation = null;
  let targetProfile = null;
  if (body.dataset_id) {
    if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
    const { data, error } = await supabase
      .from('financial_datasets')
      .select('*')
      .eq('id', String(body.dataset_id))
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) {
      return sendJson(res, 404, { ok: false, executed: false, error: { code: 'FINANCIAL_DATASET_NOT_FOUND' } });
    }

    targetProfile = await resolveFinancialIntakeProfile(supabase, serviceCode);
    if (targetProfile.error) {
      return sendJson(res, targetProfile.httpStatus, { ok:false, executed:false, error:{ code:targetProfile.error } });
    }
    const sourceFields=Array.isArray(data.field_provenance?.fields) ? data.field_provenance.fields : [];
    targetValidation=validateDataset({
      primaryAction:targetProfile.resolved.profile.primary_action,
      serviceCode,
      values:data.reviewed_values || {},
      fields:sourceFields.filter(field=>targetProfile.requirements.requirement_fields.includes(field.field))
    });
    if (targetValidation.valid !== true) {
      return sendJson(res, 409, {
        ok:false,
        executed:false,
        error:{ code:'FINANCIAL_DATASET_INCOMPATIBLE' },
        missing_fields:targetValidation.missing || [],
        unresolved:targetValidation.unresolved || []
      });
    }
    if (!['validated','executed'].includes(data.status) || data.validation?.valid !== true) {
      return sendJson(res, 409, { ok: false, executed: false, error: { code: 'FINANCIAL_DATASET_NOT_VALIDATED' } });
    }

    dataset = data;
    body = {
      ...body,
      inputs: data.reviewed_values || {},
      values: data.reviewed_values || {},
      source: 'validated_financial_dataset'
    };
  }

  try {
    const result = await executeService({ req, user, supabase, serviceCode, body });

    if (dataset) {
      const now=new Date().toISOString();
      const inputHash=stableInputHash(dataset.reviewed_values || {});
      const inputSnapshot={
        dataset_id:dataset.id,
        dataset_version:dataset.dataset_version || 1,
        service_code:serviceCode,
        values:{...(dataset.reviewed_values || {})},
        input_hash:inputHash,
        executed_at:now
      };
      const evidence = {
        dataset_id: dataset.id,
        dataset_version:dataset.dataset_version || 1,
        inputs_used: dataset.reviewed_values || {},
        input_hash:inputHash,
        source: {
          type:dataset.source_type,
          file_name:dataset.source_file_name,
          file_version:dataset.source_file_version,
          mime_type:dataset.source_mime_type
        },
        field_provenance: dataset.field_provenance?.fields || [],
        field_confidence:dataset.field_confidence || {},
        validation: targetValidation || dataset.validation || {},
        dependency_graph:buildDependencyGraph({
          requirementFields:targetProfile?.requirements?.requirement_fields || [],
          serviceCode,
          engineCode:targetProfile?.requirements?.engine_code || null
        })
      };
      result.body = { ...result.body, dataset: evidence };

      const oldHistory=Array.isArray(dataset.execution_history) ? dataset.execution_history : [];
      const successful=result.body?.executed === true;
      const historyEntry={
        service_code:serviceCode,
        engine_code:targetProfile?.requirements?.engine_code || null,
        input_hash:inputHash,
        dataset_version:dataset.dataset_version || 1,
        executed_at:now,
        stale:false,
        result_summary:{
          executed:successful,
          http_status:result.httpStatus,
          metrics:result.body?.metrics || result.body?.result?.metrics || {},
          error:result.body?.error || null
        }
      };
      const history=[...oldHistory,historyEntry].slice(-100);
      const metrics=result.body?.metrics || result.body?.result?.metrics || {};
      const decisionRecord={
        service_code:serviceCode,
        dataset_id:dataset.id,
        dataset_version:dataset.dataset_version || 1,
        deterministic:true,
        executed:successful,
        metrics,
        validation:targetValidation || {},
        benchmarking:{
          applied:false,
          reason:'trusted_source_required',
          policy:'benchmark_only_with_verified_source_provenance'
        },
        recorded_at:now
      };

      await supabase
        .from('financial_datasets')
        .update({
          status: successful ? 'executed' : 'validated',
          execution_result: result.body || {},
          execution_history:history,
          input_snapshot:inputSnapshot,
          derived_metrics:metrics,
          dependency_graph:evidence.dependency_graph,
          evidence_pack:evidence,
          decision_record:decisionRecord,
          engine_version:result.body?.engine_version || result.body?.result?.engine_version || null,
          is_stale:false,
          stale_reason:null,
          last_executed_at:now,
          updated_at:now
        })
        .eq('id', dataset.id)
        .eq('user_id', user.id);
    }

    return sendJson(res, result.httpStatus, result.body);
  } catch (err) {
    console.error('[services/execute]', err.message);
    return sendJson(res, 500, {
      ok: false,
      executed: false,
      service_code: serviceCode,
      error: { code: 'SERVICE_EXECUTION_FAILED', message: err.message }
    });
  }
}

async function handleFinancialPortfolio(req,res,supabase,user){
  if(req.method!=='GET') return sendJson(res,405,{error:'Method not allowed'});
  if(!user) return sendJson(res,401,{error:'Unauthorized'});
  const url=getQuery(req);
  const projectId=String(url.searchParams.get('project_id') || '').trim() || null;
  const clientId=String(url.searchParams.get('client_id') || '').trim() || null;
  let query=supabase
    .from('financial_datasets')
    .select('id,client_id,project_id,service_code,quality_status,status,approval_status,dataset_version,parent_dataset_id,duplicate_of_id,is_stale,last_executed_at,created_at,updated_at')
    .eq('user_id',user.id)
    .is('deleted_at',null)
    .order('updated_at',{ascending:false});
  if(projectId) query=query.eq('project_id',projectId);
  if(clientId) query=query.eq('client_id',clientId);
  const {data,error}=await query.limit(500);
  if(error) return sendJson(res,500,{ok:false,error:{code:'FINANCIAL_PORTFOLIO_LOAD_FAILED'}});

  const rows=data || [];
  const byService={};
  const byProject={};
  const byClient={};
  for(const row of rows){
    byService[row.service_code]=(byService[row.service_code]||0)+1;
    const project=row.project_id || 'unassigned';
    const client=row.client_id || 'unassigned';
    byProject[project]=(byProject[project]||0)+1;
    byClient[client]=(byClient[client]||0)+1;
  }
  return sendJson(res,200,{
    ok:true,
    portfolio:{
      filters:{project_id:projectId,client_id:clientId},
      totals:{
        datasets:rows.length,
        approved:rows.filter(row=>row.approval_status==='approved').length,
        executed:rows.filter(row=>row.status==='executed').length,
        stale:rows.filter(row=>row.is_stale===true).length
      },
      by_service:byService,
      by_project:byProject,
      by_client:byClient,
      datasets:rows
    }
  });
}

async function handleFinancialDatasetGet(req,res,supabase,user,id){
  if(!user) return sendJson(res,401,{error:'Unauthorized'});

  if(req.method==='DELETE'){
    const now=new Date().toISOString();
    const {data,error}=await supabase
      .from('financial_datasets')
      .update({deleted_at:now,updated_at:now})
      .eq('id',id).eq('user_id',user.id).is('deleted_at',null)
      .select('id,deleted_at').maybeSingle();
    if(error||!data) return sendJson(res,404,{ok:false,error:{code:'FINANCIAL_DATASET_NOT_FOUND'}});
    return sendJson(res,200,{ok:true,dataset_id:data.id,deleted_at:data.deleted_at});
  }

  if(req.method==='PATCH'){
    let body;
    try { body=await parseJsonBody(req); }
    catch(err){ return sendJson(res,400,{error:'Invalid JSON body',detail:err.message}); }
    const retention = body.retention_until === null ? null : new Date(body.retention_until);
    if(body.retention_until !== null && (!retention || Number.isNaN(retention.getTime()))) {
      return sendJson(res,400,{ok:false,error:{code:'INVALID_RETENTION_UNTIL'}});
    }
    const retentionIso = body.retention_until === null ? null : retention.toISOString();
    const {data,error}=await supabase
      .from('financial_datasets')
      .update({retention_until:retentionIso,updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',user.id).is('deleted_at',null)
      .select('id,retention_until').maybeSingle();
    if(error||!data) return sendJson(res,404,{ok:false,error:{code:'FINANCIAL_DATASET_NOT_FOUND'}});
    return sendJson(res,200,{ok:true,dataset_id:data.id,retention_until:data.retention_until});
  }

  if(req.method!=='GET') return sendJson(res,405,{error:'Method not allowed'});
  const {data,error}=await supabase
    .from('financial_datasets')
    .select('id,client_id,project_id,service_code,source_type,source_file_name,source_file_version,source_mime_type,document_type,reviewed_values,field_provenance,field_confidence,validation,quality_status,status,approval_status,dataset_version,parent_dataset_id,duplicate_of_id,input_hash,input_snapshot,derived_metrics,dependency_graph,evidence_pack,decision_record,execution_history,is_stale,stale_reason,parser_version,mapping_version,engine_version,analysis_version,retention_until,created_at,updated_at,last_executed_at')
    .eq('id',id).eq('user_id',user.id).is('deleted_at',null).maybeSingle();
  if(error||!data) return sendJson(res,404,{ok:false,error:{code:'FINANCIAL_DATASET_NOT_FOUND'}});
  return sendJson(res,200,{ok:true,dataset:data});
}

async function handleFinancialDatasetExport(req,res,supabase,user,id){
  if(req.method!=='GET') return sendJson(res,405,{error:'Method not allowed'});
  if(!user) return sendJson(res,401,{error:'Unauthorized'});
  const url=getQuery(req);
  const format=String(url.searchParams.get('format') || 'summary').toLowerCase();
  const {data,error}=await supabase
    .from('financial_datasets')
    .select('*')
    .eq('id',id).eq('user_id',user.id).is('deleted_at',null).maybeSingle();
  if(error||!data) return sendJson(res,404,{ok:false,error:{code:'FINANCIAL_DATASET_NOT_FOUND'}});
  if(data.approval_status!=='approved' || !['validated','executed'].includes(data.status)) {
    return sendJson(res,409,{ok:false,error:{code:'FINANCIAL_DATASET_NOT_APPROVED'}});
  }
  const summary=executiveSummaryForDataset(data);
  if(format==='summary'){
    const text=[
      summary.title,
      'Dataset: '+summary.dataset_id+' v'+summary.dataset_version,
      'Service: '+(summary.service_code||'unknown'),
      'Quality: '+summary.quality_status,
      'Approval: '+summary.approval_status,
      'Stale: '+String(summary.is_stale),
      '',
      'Key metrics:',
      ...Object.entries(summary.key_metrics||{}).map(([key,value])=>'- '+key+': '+(typeof value==='object'?JSON.stringify(value):String(value)))
    ].join('\n');
    return sendBinary(res,200,'text/plain; charset=utf-8','financial-executive-summary-'+id+'.txt',Buffer.from(text,'utf8'));
  }
  if(format==='xlsx' || format==='excel'){
    const workbook=XLSX.utils.book_new();
    const summaryRows=Object.entries(summary).filter(([key])=>key!=='key_metrics' && key!=='validation')
      .map(([key,value])=>({field:key,value:typeof value==='object'?JSON.stringify(value):value}));
    const metricRows=Object.entries(summary.key_metrics||{}).map(([metric,value])=>({
      metric,
      value:typeof value==='object'?JSON.stringify(value):value
    }));
    const inputRows=Object.entries(data.reviewed_values||{}).map(([field,value])=>({field,value}));
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(summaryRows),'Summary');
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(metricRows),'Metrics');
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(inputRows),'Approved Inputs');
    const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
    return sendBinary(res,200,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','financial-analysis-'+id+'.xlsx',bytes);
  }
  if(format==='pdf'){
    return sendBinary(res,200,'application/pdf','financial-analysis-'+id+'.pdf',buildSimplePdf(summary));
  }
  return sendJson(res,400,{ok:false,error:{code:'FINANCIAL_EXPORT_FORMAT_UNSUPPORTED'},supported:['summary','xlsx','pdf']});
}

async function handleServiceExecutionProfile(req, res, supabase, user, code) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    const resolved = await loadExecutionProfile(supabase, code);
    if (!resolved) return sendJson(res, 404, { error: 'Service not found' });
    return sendJson(res, 200, {
      service: {
        code: resolved.service.code,
        name_ar: resolved.service.name_ar,
        name_en: resolved.service.name_en,
        category_code: resolved.service.category_code,
        group_code: resolved.service.group_code
      },
      execution: resolved.profile,
      capabilities: resolved.capabilities
    });
  } catch (err) {
    console.error('[services/execution-profile]', err.message);
    return sendJson(res, 500, { error: 'Failed to load service execution profile' });
  }
}

async function handleCreateServiceRequest(req, res, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  let body = {};
  try {
    body = await new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
      });
    });
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const serviceCode = body.service_code;
  if (!serviceCode) return sendJson(res, 400, { error: 'service_code is required' });

  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id,code,name_ar,name_en,category_code')
    .eq('code', serviceCode)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (serviceError || !service) return sendJson(res, 400, { error: 'Service not found' });

  let canonicalActivityId = null;
  if (body.activity_code) {
    const { data: activity } = await supabase.from('canonical_activities').select('id').eq('code', body.activity_code).maybeSingle();
    canonicalActivityId = activity?.id || null;
  }

  const { data: client } = await supabase
    .from('advisory_clients')
    .select('id,organization_id')
    .eq('auth_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  let geoContext = { place: null, snapshot: {} };
  try {
    geoContext = await resolveGeoContext(supabase, {
      canonicalCode: body.canonical_geo_code || null,
      localityCode: body.locality_code || null,
      localityName: body.locality_name || null,
      countryCode: body.country_code || null
    });
  } catch (geoError) {
    console.warn('[services/requests] geo resolve failed:', geoError.message);
  }

  const requestRow = {
    user_id: user.id,
    client_id: client?.id || null,
    service_id: service.id,
    package_id: body.package_id || null,
    goal_code: body.goal_code || null,
    country_code: body.country_code || null,
    region_code: body.region_code || null,
    region_name: body.region_name || null,
    locality_code: body.locality_code || null,
    locality_name: body.locality_name || null,
    geo_place_id: geoContext.place?.id || null,
    geo_snapshot: geoContext.snapshot || {},
    sector_code: body.sector_code || null,
    canonical_activity_id: canonicalActivityId,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    metadata: { source: body.source || 'service_discovery', ...(body.metadata || {}) }
  };

  const { data: requestRowOut, error: requestError } = await supabase
    .from('service_requests')
    .insert(requestRow)
    .select('id,request_reference,status,geo_place_id,geo_snapshot,created_at')
    .single();
  if (requestError) return sendJson(res, 400, { error: requestError.message });

  if (body.values && typeof body.values === 'object' && !Array.isArray(body.values)) {
    const valueRows = Object.entries(body.values).map(([field_key,value]) => ({
      service_request_id: requestRowOut.id,
      field_key,
      value,
      form_version: body.form_version || null
    }));
    if (valueRows.length) {
      const { error: valuesError } = await supabase.from('service_request_values').insert(valueRows);
      if (valuesError) return sendJson(res, 400, { error: valuesError.message, request: requestRowOut });
    }
  }

  await supabase.from('calculator_events').insert({
    event:'service_requested',
    calculator:'service_discovery',
    country:body.country_code || null,
    lang:body.lang || null,
    user_id:user.id,
    action:'request',
    properties:{
      service_code:serviceCode,
      sector_code:body.sector_code||null,
      activity_code:body.activity_code||null,
      geo_place_id:geoContext.place?.id||null,
      canonical_geo_code:geoContext.snapshot?.canonical_geo_code||null
    },
    url:body.url || null
  });

  let opportunity = null;
  if (client?.id) {
    const { data } = await supabase
      .from('crm_opportunities')
      .insert({
        organization_id: client.organization_id || null,
        client_id: client.id,
        title: service.name_ar,
        stage: 'lead',
        probability: 10,
        source: 'service_request',
        service_request_id: requestRowOut.id,
        created_by: user.id
      })
      .select('id')
      .maybeSingle();
    opportunity = data || null;
    if (opportunity?.id) {
      await supabase.from('service_requests').update({ crm_opportunity_id: opportunity.id }).eq('id', requestRowOut.id);
    }
  }

  return sendJson(res, 201, { request: requestRowOut, crm_opportunity_id: opportunity?.id || null });
}


function rowMatchesContext(row, filters) {
  if (row.country_code && filters.country && row.country_code !== filters.country) return false;
  if (row.country_code && !filters.country) return false;
  if (row.sector_code && filters.sector && row.sector_code !== filters.sector) return false;
  if (row.sector_code && !filters.sector) return false;
  return true;
}

async function handleServiceDetail(req, res, supabase, code) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const filters = {
    country: (url.searchParams.get('country') || '').toUpperCase() || null,
    sector: url.searchParams.get('sector') || null,
    activity: url.searchParams.get('activity') || null
  };

  const { data: service, error } = await supabase
    .from('service_catalog')
    .select('id,code,category_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,sort_order,default_route_ar,default_route_en,metadata')
    .eq('code', code)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (error || !service) return sendJson(res, 404, { error: 'Service not found' });

  let activityId = null;
  if (filters.activity) {
    const { data: activity } = await supabase.from('canonical_activities').select('id').eq('code', filters.activity).maybeSingle();
    activityId = activity?.id || null;
  }

  const [capRes,procRes,reqRes,delRes,depRes,formRes,pricingRes,countryRes] = await Promise.all([
    supabase.from('service_capability_map').select('capability_code,run_order,is_required').eq('service_id',service.id).order('run_order'),
    supabase.from('service_procedures').select('id,country_code,sector_code,canonical_activity_id,title_ar,title_en,description_ar,description_en,procedure_type,visibility,capability_code,sort_order,is_required,conditions,metadata').eq('service_id',service.id).eq('visibility','public').order('sort_order'),
    supabase.from('service_requirements').select('id,country_code,sector_code,requirement_type,label_ar,label_en,is_required,sort_order,conditions,metadata').eq('service_id',service.id).order('sort_order'),
    supabase.from('service_deliverables').select('id,code,name_ar,name_en,deliverable_type,sort_order,metadata').eq('service_id',service.id).order('sort_order'),
    supabase.from('service_dependencies').select('depends_on_service_id,dependency_type,conditions,metadata').eq('service_id',service.id),
    supabase.from('service_form_definitions').select('id,code,name_ar,name_en,country_code,sector_code,version,status,conditions,metadata').eq('service_id',service.id).eq('status','published').eq('is_active',true),
    supabase.from('service_pricing').select('id,country_code,sector_code,pricing_type,currency_code,amount,min_amount,max_amount,conditions,valid_from,valid_to,metadata').eq('service_id',service.id).eq('is_active',true),
    filters.country
      ? supabase.from('service_country_map').select('country_code,availability_status,availability_reason_ar,availability_reason_en,priority,metadata').eq('service_id',service.id).eq('country_code',filters.country).maybeSingle()
      : Promise.resolve({data:null,error:null})
  ]);
  const failed=[capRes,procRes,reqRes,delRes,depRes,formRes,pricingRes,countryRes].find(x=>x.error);
  if(failed?.error) return sendJson(res,500,{error:'Failed to load service details'});

  const procedures=(procRes.data||[]).filter(row=>{
    if(!rowMatchesContext(row,filters)) return false;
    if(row.canonical_activity_id && activityId && row.canonical_activity_id!==activityId) return false;
    if(row.canonical_activity_id && !activityId) return false;
    return true;
  });
  const requirements=(reqRes.data||[]).filter(row=>rowMatchesContext(row,filters));
  const pricing=(pricingRes.data||[]).filter(row=>rowMatchesContext(row,filters)).filter(row=>{
    const today=new Date().toISOString().slice(0,10);
    return (!row.valid_from || row.valid_from<=today) && (!row.valid_to || row.valid_to>=today);
  });

  const candidates=(formRes.data||[]).filter(row=>rowMatchesContext(row,filters)).sort((a,b)=>{
    const score=x=>(x.country_code?2:0)+(x.sector_code?1:0);
    return score(b)-score(a) || Number(b.version||0)-Number(a.version||0);
  });
  const form=candidates[0]||null;
  let fields=[];
  if(form){
    const {data,error:fieldsError}=await supabase.from('service_form_fields').select('*').eq('form_id',form.id).order('sort_order');
    if(fieldsError) return sendJson(res,500,{error:'Failed to load service form'});
    fields=data||[];
  }

  const dependencyIds=(depRes.data||[]).map(x=>x.depends_on_service_id);
  let dependencyServices=[];
  if(dependencyIds.length){
    const {data}=await supabase.from('service_catalog').select('id,code,name_ar,name_en,default_route_ar,default_route_en').in('id',dependencyIds);
    dependencyServices=data||[];
  }
  const dependencies=(depRes.data||[]).map(row=>({
    ...row,
    service:dependencyServices.find(x=>x.id===row.depends_on_service_id)||null
  }));

  let intake = { supported:false, execution_status:null, execution_mode:null, requirement_fields:[] };
  try {
    const resolved = await loadExecutionProfile(supabase, code);
    if (resolved) {
      const intakeRequirements = requirementsFor({
        primaryAction: resolved.profile.primary_action,
        serviceCode: code,
        values: {}
      });
      intake = {
        supported: intakeRequirements.supported === true,
        execution_status: resolved.profile.execution_status || 'request_only',
        execution_mode: resolved.profile.execution_mode || 'request_only',
        requirement_fields: intakeRequirements.requirement_fields || []
      };
    }
  } catch (intakeError) {
    console.warn('[services/detail] intake profile unavailable:', intakeError.message);
  }

  return sendJson(res,200,{
    service,
    filters,
    availability:countryRes.data||null,
    capabilities:capRes.data||[],
    intake,
    procedures,
    requirements,
    deliverables:delRes.data||[],
    dependencies,
    pricing,
    form:form?{...form,fields}:null
  });
}

async function servicesRouter(req, res, path, supabase, user) {
  if (path === '/services' || path === '/services/catalog') return handleServiceCatalog(req, res, supabase);
  if (path === '/services/goals') return handleServiceGoals(req, res, supabase);
  if (path === '/services/packages') return handleServicePackages(req, res, supabase);
  if (path === '/services/execute') return handleServiceExecute(req, res, supabase, user);
  if (path === '/services/intake/prepare') return handleFinancialIntakePrepare(req, res, supabase, user);
  if (path === '/services/intake/approve') return handleFinancialIntakeApprove(req, res, supabase, user);
  if (path === '/services/intake/portfolio') return handleFinancialPortfolio(req, res, supabase, user);
  const datasetExportMatch=path.match(/^\/services\/intake\/datasets\/([^/]+)\/export$/);
  if(datasetExportMatch) return handleFinancialDatasetExport(req,res,supabase,user,decodeURIComponent(datasetExportMatch[1]));
  const datasetMatch=path.match(/^\/services\/intake\/datasets\/([^/]+)$/);
  if(datasetMatch) return handleFinancialDatasetGet(req,res,supabase,user,decodeURIComponent(datasetMatch[1]));
  if (path === '/services/requests') return handleCreateServiceRequest(req, res, supabase, user);
  const executionMatch=path.match(/^\/services\/([^/]+)\/execution$/);
  if (executionMatch) return handleServiceExecutionProfile(req,res,supabase,user,decodeURIComponent(executionMatch[1]));
  const detailMatch=path.match(/^\/services\/([^/]+)$/);
  if (detailMatch) return handleServiceDetail(req,res,supabase,decodeURIComponent(detailMatch[1]));
  return sendJson(res, 404, { error: 'Service resource not found' });
}

module.exports = { servicesRouter, listPublishedServices };
