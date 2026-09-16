<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreQdnRequest;
use App\Models\AnalogCalendar;
use App\Models\Customer;
use App\Models\Location;
use App\Models\Machine;
use App\Models\Nonconformity;
use App\Models\Package;
use App\Models\Qdn;
use App\Models\QdnRcaCause;
use App\Services\QdnNumberGenerator;
use App\Support\CurrentEmployee;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QdnController extends Controller
{
    /**
     * Step 1: Create QDN form.
     */
    public function create(): Response
    {
        return Inertia::render('Qdn/Create', [
            'customers' => Customer::orderBy('customer_name')->get(['id', 'customer_name']),
            'machines' => Machine::orderBy('machine_no')->get(['id', 'machine_no']),
            'locations' => Location::orderBy('location_name')->get(['id', 'location_name']),
            'nonconformities' => Nonconformity::orderBy('nonconformity_name')
                ->get(['id', 'nonconformity_name', 'nonconformity_category'])
                ->map(fn (Nonconformity $n) => [
                    'id' => $n->id,
                    'nonconformity_name' => $n->nonconformity_name,
                    'nonconformity_category' => $n->nonconformity_category,
                    // Normalized 1/2/3, regardless of whether the raw
                    // column is an int, a numeric string, or "1-Minor" --
                    // see Nonconformity::categoryNumber(). The Create form
                    // keys its Classification auto-fill off this field.
                    'category_number' => $n->categoryNumber(),
                ])
                ->values(),
            // Issued By is no longer free text -- it's whoever is logged in via
            // SSO, per session('emp_data.emp_name') (see AuthMiddleware /
            // CurrentEmployee). NOT $request->user(), which your app never
            // populates via Laravel's Auth facade.
            'issuedByName' => CurrentEmployee::name(),
        ]);
    }

    /**
     * AJAX lookup used by the Create form: given a device name, resolve
     * the package_type from qdn_db.package_list (devicename -> package_type).
     */
    public function packageLookup(Request $request): JsonResponse
    {
        $request->validate(['device_name' => ['required', 'string']]);

        $packageType = Package::typeForDevice($request->string('device_name'));

        return response()->json(['package_name' => $packageType]);
    }

    /**
     * Persist the QDN, auto-generate its number, snapshot lookup labels,
     * derive the classification, and route it to Department: PE.
     */
    public function store(StoreQdnRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $customer = Customer::find($data['customer_id']);
        $machine = Machine::find($data['machine_id']);
        $location = Location::find($data['location_id']);
        $nonconformity = Nonconformity::find($data['nonconformity_id']);

        $qdn = Qdn::create([
            'qdn_no' => QdnNumberGenerator::next(),
            'customer_id' => $data['customer_id'],
            'customer_name' => $customer?->customer_name,
            'lot_id' => $data['lot_id'],
            'lot_qty' => $data['lot_qty'],
            'device_name' => $data['device_name'],
            'package_name' => Package::typeForDevice($data['device_name']),
            'machine_id' => $data['machine_id'],
            'machine_no' => $machine?->machine_no,
            'location_id' => $data['location_id'],
            'detection_area' => $location?->location_name,
            'detected_at' => $data['detected_at'],
            'nonconformity_id' => $data['nonconformity_id'],
            'nonconformity_name' => $nonconformity?->nonconformity_name,
            // Normalized to a plain 1/2/3 int -- see
            // Nonconformity::categoryNumber(). Storing the raw column
            // value here would risk an insert error if it's ever a
            // string like "1-Minor" against qdns.nonconformity_category's
            // unsignedTinyInteger column.
            'nonconformity_category' => $nonconformity?->categoryNumber(),
            'classification' => $nonconformity?->classificationLabel(),
            'details' => $data['details'],
            'status' => Qdn::STATUS_PENDING_PE,
            // Server-derived from session('emp_data'), not client input.
            'issued_by' => CurrentEmployee::name(),
        ]);

        return redirect()
            ->route('qdn.dashboard')
            ->with('success', "QDN {$qdn->qdn_no} submitted and routed to Department: PE.");
    }

    // Which column (or relation, for failure_mode) the Pareto groups by.
    // Whitelisted the same way RECORDS_SORTABLE is -- $request->query('group_by')
    // never picks an arbitrary column to group by.
    private const DASHBOARD_GROUP_BY = ['failure_mode', 'detection_area', 'nonconformity', 'customer'];

    /**
     * QDN Dashboard -- replaced the old "three lists" (Pending / In
     * Progress / Invalid, scoped to the current employee/department) with
     * a filterable Pareto analysis: pick which dimension to rank
     * (Failure Mode / Detection Area / Non-Conformity / Customer), filter
     * by date range or calendar Work Week plus any combination of
     * detection area / non-conformity / customer / failure mode (each
     * multi-select), and get back a ranked count-and-cumulative-% table,
     * a Pareto chart, and the full list of QDNs behind those numbers.
     *
     * Every workflow queue (PE Validation, Dept RCA/CAPA/Approval, QA
     * Verification, "QDNs for My Department") already has its own
     * permanent sidebar link (see Navigation.jsx) and its own
     * department/role scoping enforced server-side in
     * QdnWorkflowController -- so this page dropping the old personal/
     * department-scoped lists doesn't strand anyone; those queues are
     * reached from the sidebar, not from here. This view intentionally
     * covers the FULL QDN history, same as records() below, since a
     * Pareto is a company/QA-wide analysis, not a personal inbox.
     */
    public function dashboard(Request $request): Response
    {
        $groupBy = in_array($request->query('group_by'), self::DASHBOARD_GROUP_BY, true)
            ? $request->query('group_by')
            : 'failure_mode';

        $query = Qdn::query();

        // Work Week -- identical handling to records() below, backed by
        // the analog_calendar table (see App\Models\AnalogCalendar).
        // Wins over an explicit date range if both are somehow submitted
        // at once (the UI only ever sends one or the other).
        $workWeek = trim((string) $request->query('workweek', ''));
        if ($workWeek !== '') {
            [$year, $ww] = array_pad(explode('-', $workWeek, 2), 2, null);
            $range = AnalogCalendar::query()
                ->where('cal_year', $year)
                ->where('cal_workweek', $ww)
                ->selectRaw('MIN(cal_date) as date_start, MAX(cal_date) as date_end')
                ->first();
            if ($range?->date_start && $range?->date_end) {
                $query->whereBetween('created_at', [
                    Carbon::parse($range->date_start)->startOfDay(),
                    Carbon::parse($range->date_end)->endOfDay(),
                ]);
            }
        } else {
            // Sargable range comparisons on the raw column -- NOT
            // whereDate('created_at', ...), which wraps the column in
            // DATE(...) and stops MySQL from using qdns_created_at_index /
            // qdns_status_created_at_index at all. At 100k+ rows that's
            // the difference between an index range scan and a full table
            // scan every time someone picks a date range. Matches the
            // Work Week branch above, which was already sargable.
            if ($request->filled('date_from')) {
                $query->where('created_at', '>=', Carbon::parse($request->query('date_from'))->startOfDay());
            }
            if ($request->filled('date_to')) {
                $query->where('created_at', '<=', Carbon::parse($request->query('date_to'))->endOfDay());
            }
        }

        // Every one of these is multi-select on the frontend -- arrives
        // as e.g. detection_area[]=A&detection_area[]=B, so
        // $request->query('detection_area') is already an array (or
        // absent). array_filter() drops any blank entries a <select
        // multiple> can't actually produce, but costs nothing to guard.
        $detectionAreas = array_values(array_filter((array) $request->query('detection_area', [])));
        if ($detectionAreas) {
            $query->whereIn('detection_area', $detectionAreas);
        }

        $nonconformityIds = array_values(array_filter((array) $request->query('nonconformity_id', [])));
        if ($nonconformityIds) {
            $query->whereIn('nonconformity_id', $nonconformityIds);
        }

        $customerIds = array_values(array_filter((array) $request->query('customer_id', [])));
        if ($customerIds) {
            $query->whereIn('customer_id', $customerIds);
        }

        // Failure Mode isn't a column on qdns -- it lives on each RCA
        // cause row (a QDN can carry more than one Source of Defect), so
        // filtering by it means "this QDN has at least one RCA cause with
        // one of these defect sources."
        $failureModes = array_values(array_filter((array) $request->query('failure_mode', [])));
        if ($failureModes) {
            $query->whereHas('rcaCauses', fn ($q) => $q->whereIn('defect_source_name', $failureModes));
        }

        // Captured before the aggregate query below reshapes a clone with
        // its own select()/groupBy() -- both the record list and the
        // Pareto counts need to start from this same filtered set.
        $baseQuery = clone $query;

        // The QDNs behind these numbers -- capped at 500 rather than
        // paginated, since this is "what's behind the chart," not a
        // browsing view (that's Records). Same summary columns as the
        // Dashboard's old lists / Records' table.
        $qdns = (clone $baseQuery)
            ->orderByDesc('created_at')
            ->limit(500)
            ->get([
                'id', 'qdn_no', 'customer_name', 'device_name', 'detection_area',
                'nonconformity_name', 'classification', 'status', 'issued_department', 'created_at',
            ])
            ->map(fn (Qdn $qdn) => [
                'id' => $qdn->id,
                'qdn_no' => $qdn->qdn_no,
                'customer_name' => $qdn->customer_name,
                'device_name' => $qdn->device_name,
                'detection_area' => $qdn->detection_area,
                'nonconformity_name' => $qdn->nonconformity_name,
                'classification' => $qdn->classification,
                'status' => $qdn->status,
                'status_label' => $qdn->statusLabel(),
                'issued_department' => $qdn->issued_department,
                'created_at' => $qdn->created_at,
            ]);

        $compliance = $this->buildComplianceRollup($baseQuery);

        if ($groupBy === 'failure_mode') {
            $qdnIds = (clone $baseQuery)->pluck('id');
            $paretoData = QdnRcaCause::whereIn('qdn_id', $qdnIds)
                ->whereNotNull('defect_source_name')
                ->where('defect_source_name', '!=', '')
                ->select('defect_source_name as label')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('defect_source_name')
                ->orderByDesc('count')
                ->get();
        } else {
            $column = match ($groupBy) {
                'detection_area' => 'detection_area',
                'nonconformity' => 'nonconformity_name',
                'customer' => 'customer_name',
            };
            $paretoData = (clone $baseQuery)
                ->whereNotNull($column)
                ->where($column, '!=', '')
                ->select("{$column} as label")
                ->selectRaw('COUNT(*) as count')
                ->groupBy($column)
                ->orderByDesc('count')
                ->get();
        }

        return Inertia::render('Qdn/Dashboard', [
            'groupBy' => $groupBy,
            'paretoData' => $paretoData,
            'qdns' => $qdns,
            'compliance' => $compliance,
            'totalCount' => $baseQuery->count(),
            'filters' => $request->only([
                'date_from', 'date_to', 'workweek', 'detection_area',
                'nonconformity_id', 'customer_id', 'failure_mode', 'group_by',
            ]),
            'filterOptions' => [
                'detectionAreas' => Qdn::whereNotNull('detection_area')
                    ->where('detection_area', '!=', '')
                    ->distinct()
                    ->orderBy('detection_area')
                    ->pluck('detection_area'),
                'nonconformities' => Nonconformity::orderBy('nonconformity_name')
                    ->get(['id', 'nonconformity_name']),
                'customers' => Customer::orderBy('customer_name')->get(['id', 'customer_name']),
                'failureModes' => QdnRcaCause::whereNotNull('defect_source_name')
                    ->where('defect_source_name', '!=', '')
                    ->distinct()
                    ->orderBy('defect_source_name')
                    ->pluck('defect_source_name'),
                'workWeeks' => AnalogCalendar::query()
                    ->selectRaw('cal_year, cal_workweek, MIN(cal_date) as date_start, MAX(cal_date) as date_end')
                    ->groupBy('cal_year', 'cal_workweek')
                    ->orderByDesc('cal_year')
                    ->orderByDesc('cal_workweek')
                    ->get()
                    ->map(fn ($w) => [
                        'value' => "{$w->cal_year}-{$w->cal_workweek}",
                        'year' => $w->cal_year,
                        'workweek' => $w->cal_workweek,
                        'date_start' => $w->date_start,
                        'date_end' => $w->date_end,
                    ]),
            ],
        ]);
    }

    // Which of the TELFORD QDN Response Analysis Requirements' 12 elements
    // are actually checked against real data, in display order. Field
    // mapping per the user-supplied QDN_Compliance_Record.xlsx (the
    // authoritative source-column reference for each element -- see the
    // per-element comments in buildComplianceRollup()/complianceIndex()).
    // #9 Preventive Action is the one element still absent -- nothing in
    // this schema captures it (no dedicated field), so it always reads
    // "Not Captured"; the frontend renders it as a fixed N/A rather than
    // pretending it's computed. #10 Systemic/Horizontal Deployment DOES
    // have a real basis per that mapping (occurrence count of the same
    // nonconformity), scored as "yes" when a QDN's nonconformity has
    // occurred more than once across the whole qdns table.
    private const COMPLIANCE_ELEMENTS = [
        'problem_description' => '1. Problem Description',
        'where_when' => '2. Where & When Detected',
        'magnitude' => '3. Problem Magnitude / Impact',
        'containment' => '4. Immediate Containment',
        'rca_occurrence' => '5. RCA - Occurrence',
        'rca_escape' => '6. RCA - Escape/Detection',
        'rca_validation' => '7. Root Cause Validation',
        'corrective_action' => '8. Corrective Action',
        'systemic_deployment' => '10. Systemic/Horizontal Deployment',
        'effectiveness_verification' => '11. Effectiveness Verification',
        'closure_evidence' => '12. Closure Evidence',
    ];

    /**
     * QDN response quality rollup against the TELFORD standard (12
     * elements / 10-question checklist / 5-block model), scoped to
     * whatever the Dashboard's filters currently select ($baseQuery is
     * the same filtered-but-not-yet-aggregated clone the Pareto and QDN
     * list build from).
     *
     * Built for 100k+ qdns: every number here comes from a database
     * aggregate (AVG/COUNT), never a per-row PHP loop over fetched
     * models -- the column-based checks (problem description, RCA
     * validation, etc.) run as ONE query using conditional AVG(CASE WHEN
     * ...), and the join-based checks (does this QDN have a containment
     * lot / an RCA cause row) run as indexed WHERE EXISTS queries via
     * whereHas(), relying on the indexes added in the
     * 2026_08_26_000001 migration. Total: ~5 aggregate queries touching
     * the filtered set, regardless of whether that set is 5 rows or 5
     * million.
     *
     * Per-QDN detail (which specific QDNs are missing what) intentionally
     * isn't computed here -- that's a separate, paginated page
     * (complianceIndex() below), not something you can respons­ibly render
     * as one big table once there are 100k+ QDNs.
     *
     * "Magnitude" only has lot_qty to check -- not the confirmed/
     * rejected/suspected quantities the standard actually asks for --
     * scored on presence, with that limitation called out in the
     * frontend rather than pretending it's a full check.
     */
    private function buildComplianceRollup($baseQuery): array
    {
        $total = (clone $baseQuery)->count();

        if ($total === 0) {
            $elementRates = array_map(fn ($key, $label) => ['key' => $key, 'label' => $label, 'percent' => 0.0], array_keys(self::COMPLIANCE_ELEMENTS), self::COMPLIANCE_ELEMENTS);

            return [
                'count' => 0,
                'elementRates' => array_values($elementRates),
                'blockRollup' => [
                    ['block' => '1 — DEFINE', 'focus' => 'Problem definition', 'percent' => 0.0],
                    ['block' => '2 — ANALYZE', 'focus' => 'Cause analysis', 'percent' => 0.0],
                    ['block' => '3 — VALIDATE', 'focus' => 'Cause validation', 'percent' => 0.0],
                    ['block' => '4 — ACT', 'focus' => 'Corrective response', 'percent' => 0.0],
                    ['block' => '5 — VERIFY', 'focus' => 'Effectiveness and closure', 'percent' => 0.0],
                ],
                'questionRollup' => [],
                'averageCompletion' => 0.0,
            ];
        }

        // Field basis per QDN_Compliance_Record.xlsx (the user-supplied
        // element -> column mapping): #1 Problem Description reads
        // nonconformity_name (not the free-text `details` field -- that
        // column holds richer narrative, but the standard's own mapping
        // points at the categorized nonconformity instead); #7 Root
        // Cause Validation reads rca_validation_remarks OR pe_disposition
        // (either counts as "validated"), not rca_validated_by.
        $columnStats = (clone $baseQuery)->selectRaw(
            "AVG(CASE WHEN nonconformity_name IS NOT NULL AND nonconformity_name != '' THEN 1 ELSE 0 END) as problem_description,
             AVG(CASE WHEN detection_area IS NOT NULL AND detected_at IS NOT NULL THEN 1 ELSE 0 END) as where_when,
             AVG(CASE WHEN lot_qty IS NOT NULL THEN 1 ELSE 0 END) as magnitude,
             AVG(CASE WHEN (rca_validation_remarks IS NOT NULL AND rca_validation_remarks != '') OR pe_disposition IS NOT NULL THEN 1 ELSE 0 END) as rca_validation,
             AVG(CASE WHEN capa_corrective_what IS NOT NULL AND capa_corrective_what != '' THEN 1 ELSE 0 END) as corrective_action,
             AVG(CASE WHEN qa_capa_implemented IS NOT NULL THEN 1 ELSE 0 END) as effectiveness_verification,
             AVG(CASE WHEN status = ? AND qa_verified_by IS NOT NULL THEN 1 ELSE 0 END) as closure_evidence",
            [Qdn::STATUS_CLOSED]
        )->first();

        $containmentCount = (clone $baseQuery)->whereHas('capaContainmentLots')->count();
        $rcaOccurrenceCount = (clone $baseQuery)->whereHas('rcaCauses', fn ($q) => $q->where('cause_type', 'event'))->count();
        $rcaEscapeCount = (clone $baseQuery)->whereHas('rcaCauses', fn ($q) => $q->where('cause_type', 'escape'))->count();

        // Systemic/Horizontal Deployment (#10) -- per the mapping doc,
        // "counts if same nonconformity_name occurrence/no. of
        // occurrence": a QDN counts as "yes" here when its nonconformity
        // has shown up more than once across the WHOLE qdns table (a
        // recurring problem, which is exactly what horizontal/systemic
        // deployment exists to address) -- not just within the current
        // filter, since recurrence is a fact about the nonconformity
        // itself, not about whatever date range is selected. The join
        // to a GROUP BY subquery keyed on nonconformity_id (indexed via
        // qdns_nonconformity_id_index) keeps this one aggregate query
        // regardless of table size.
        $systemicRate = (clone $baseQuery)
            ->join(
                DB::raw('(SELECT nonconformity_id, COUNT(*) as occurrences FROM qdns GROUP BY nonconformity_id) as qdn_occurrence_counts'),
                'qdn_occurrence_counts.nonconformity_id',
                '=',
                'qdns.nonconformity_id'
            )
            ->selectRaw('AVG(CASE WHEN qdn_occurrence_counts.occurrences > 1 THEN 1 ELSE 0 END) as rate')
            ->value('rate');

        $rates = [
            'problem_description' => round(((float) $columnStats->problem_description) * 100, 1),
            'where_when' => round(((float) $columnStats->where_when) * 100, 1),
            'magnitude' => round(((float) $columnStats->magnitude) * 100, 1),
            'containment' => round($containmentCount / $total * 100, 1),
            'rca_occurrence' => round($rcaOccurrenceCount / $total * 100, 1),
            'rca_escape' => round($rcaEscapeCount / $total * 100, 1),
            'rca_validation' => round(((float) $columnStats->rca_validation) * 100, 1),
            'corrective_action' => round(((float) $columnStats->corrective_action) * 100, 1),
            'systemic_deployment' => round(((float) $systemicRate) * 100, 1),
            'effectiveness_verification' => round(((float) $columnStats->effectiveness_verification) * 100, 1),
            'closure_evidence' => round(((float) $columnStats->closure_evidence) * 100, 1),
        ];

        $elementRates = [];
        foreach (self::COMPLIANCE_ELEMENTS as $key => $label) {
            $elementRates[] = ['key' => $key, 'label' => $label, 'percent' => $rates[$key]];
        }

        $avg = fn (array $keys) => round(array_sum(array_map(fn ($k) => $rates[$k], $keys)) / count($keys), 1);

        // 5-Block Model -- mirrors the sheet's Block/Focus columns.
        // Preventive Action (#9) is the only element still without a
        // field, so Block 4 (ACT) averages Containment + Corrective
        // Action + Systemic/Horizontal Deployment (#10 now has a real
        // basis -- see $systemicRate above).
        $blockRollup = [
            ['block' => '1 — DEFINE', 'focus' => 'Problem definition', 'percent' => $avg(['problem_description', 'where_when', 'magnitude'])],
            ['block' => '2 — ANALYZE', 'focus' => 'Cause analysis', 'percent' => $avg(['rca_occurrence', 'rca_escape'])],
            ['block' => '3 — VALIDATE', 'focus' => 'Cause validation', 'percent' => $rates['rca_validation']],
            ['block' => '4 — ACT', 'focus' => 'Corrective response', 'percent' => $avg(['containment', 'corrective_action', 'systemic_deployment'])],
            ['block' => '5 — VERIFY', 'focus' => 'Effectiveness and closure', 'percent' => $avg(['effectiveness_verification', 'closure_evidence'])],
        ];

        // 10-Question Checklist -- Q2/Q3 (Where/When) share one underlying
        // check (detection_area + detected_at aren't tracked separately),
        // and Q9 only reflects Corrective Action since Preventive Action
        // isn't captured -- both noted explicitly rather than silently
        // scored as if they were fully covered.
        $questionRollup = [
            ['no' => 1, 'question' => 'WHAT happened?', 'percent' => $rates['problem_description'], 'note' => null],
            ['no' => 2, 'question' => 'WHERE did it happen?', 'percent' => $rates['where_when'], 'note' => 'Shares one underlying check with Q3 -- Where & When are recorded together today.'],
            ['no' => 3, 'question' => 'WHEN did it happen?', 'percent' => $rates['where_when'], 'note' => 'Shares one underlying check with Q2 -- Where & When are recorded together today.'],
            ['no' => 4, 'question' => 'HOW MUCH was affected?', 'percent' => $rates['magnitude'], 'note' => 'Only total lot quantity is checked, not confirmed/rejected/suspected quantities.'],
            ['no' => 5, 'question' => 'WHAT was contained?', 'percent' => $rates['containment'], 'note' => null],
            ['no' => 6, 'question' => 'WHY did it happen?', 'percent' => $rates['rca_occurrence'], 'note' => null],
            ['no' => 7, 'question' => 'WHY was it not detected?', 'percent' => $rates['rca_escape'], 'note' => null],
            ['no' => 8, 'question' => 'HOW was the root cause validated?', 'percent' => $rates['rca_validation'], 'note' => null],
            ['no' => 9, 'question' => 'WHAT will prevent recurrence?', 'percent' => $rates['corrective_action'], 'note' => 'Reflects Corrective Action only -- Preventive Action has no field in this schema yet.'],
            ['no' => 10, 'question' => 'HOW will we know it worked?', 'percent' => $rates['effectiveness_verification'], 'note' => null],
        ];

        return [
            'count' => $total,
            'elementRates' => $elementRates,
            'blockRollup' => $blockRollup,
            'questionRollup' => $questionRollup,
            'averageCompletion' => round(array_sum($rates) / count($rates), 1),
        ];
    }

    /**
     * Per-QDN Compliance Detail -- the paginated drill-down the Dashboard
     * rollup above intentionally doesn't try to render inline. Same
     * filters as Records (q/status_group/date/detection_area/etc. would
     * be easy to bolt on later); kept intentionally simple for now:
     * search by QDN No, paginate 25/page, compute the 10 element
     * booleans only for THIS PAGE's ~25 rows -- not the whole filtered
     * set -- so this stays cheap no matter how large qdns grows.
     */
    public function complianceIndex(Request $request): Response
    {
        $term = trim((string) $request->query('q', ''));

        $query = Qdn::query();
        if ($term !== '') {
            $query->where('qdn_no', 'like', "%{$term}%");
        }

        $qdns = $query->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        // Real field values behind each element, per the user-supplied
        // QDN_Compliance_Record.xlsx column mapping -- fetched only for
        // this page's ~25 rows (2 lookup queries + 1 occurrence-count
        // query, all keyed off the small id/nonconformity_id set on this
        // page), same scale story as the existence-check version this
        // replaces: the badge tells you yes/no/partial, this makes the
        // actual data underneath it visible instead of a QDN No you'd
        // have to go open separately to check.
        $ids = collect($qdns->items())->pluck('id');

        // round filtered in PHP below (against each $qdn->capa_round) --
        // simpler and just as cheap as a raw subquery for a page this size.
        $containmentLots = DB::table('qdn_capa_containment_lots')
            ->whereIn('qdn_id', $ids)
            ->orderBy('sort_order')
            ->get(['qdn_id', 'round', 'lot_id', 'part_name', 'qty', 'result_of_inspection', 'date_processed'])
            ->groupBy('qdn_id');

        $rcaCauses = DB::table('qdn_rca_causes')
            ->whereIn('qdn_id', $ids)
            ->orderBy('sort_order')
            ->get(['qdn_id', 'cause_type', 'reason_root_cause_name', 'cause', 'defect_name', 'defect_source_name'])
            ->groupBy('qdn_id');

        // Systemic/Horizontal Deployment (#10) -- occurrence count of the
        // same nonconformity, scoped to just the nonconformity_ids on
        // this page (a handful of IN() values, served by
        // qdns_nonconformity_id_index -- not a full-table scan).
        $nonconformityIds = collect($qdns->items())->pluck('nonconformity_id')->filter()->unique()->values();
        $occurrenceCounts = Qdn::whereIn('nonconformity_id', $nonconformityIds)
            ->selectRaw('nonconformity_id, COUNT(*) as occurrences')
            ->groupBy('nonconformity_id')
            ->pluck('occurrences', 'nonconformity_id');

        $formatDate = fn ($value, $withTime = false) => $value ? Carbon::parse($value)->format($withTime ? 'M j, Y g:i A' : 'M j, Y') : null;

        $qdns->through(function (Qdn $qdn) use ($containmentLots, $rcaCauses, $occurrenceCounts, $formatDate) {
            $lots = $containmentLots->get($qdn->id, collect())->where('round', $qdn->capa_round);
            $causes = $rcaCauses->get($qdn->id, collect());
            $occurrenceCauses = $causes->where('cause_type', 'event');
            $escapeCauses = $causes->where('cause_type', 'escape');
            $occurrences = (int) ($occurrenceCounts->get($qdn->nonconformity_id) ?? 1);

            $causeText = fn ($c) => $c->defect_source_name ?: ($c->reason_root_cause_name ?: $c->cause);

            $details = [
                'problem_description' => $qdn->nonconformity_name ?: null,
                'where_when' => $qdn->detection_area && $qdn->detected_at
                    ? "{$qdn->detection_area} — {$formatDate($qdn->detected_at, true)}"
                    : null,
                // qdns.machine_num -- the denormalized snapshot column on
                // qdns itself (per your DB), NOT Machine::machine_no (the
                // separate machine_list lookup table's column, used
                // elsewhere for the "select a machine" dropdowns and
                // unaffected by this).
                'magnitude' => $qdn->lot_id
                    ? "Lot {$qdn->lot_id} · qty {$qdn->lot_qty}" . ($qdn->machine_num ? " · {$qdn->machine_num}" : '')
                    : null,
                'containment' => $lots->isEmpty() ? null : $lots->map(
                    fn ($l) => "Lot {$l->lot_id} (qty " . ($l->qty ?? '—') . '): ' . ($l->result_of_inspection ?: '—')
                )->implode('; '),
                'rca_occurrence' => $occurrenceCauses->isEmpty() ? null : $occurrenceCauses->map($causeText)->filter()->implode('; '),
                'rca_escape' => $escapeCauses->isEmpty() ? null : $escapeCauses->map($causeText)->filter()->implode('; '),
                'rca_validation' => $qdn->rca_validation_remarks
                    ?: ($qdn->pe_disposition ? 'PE: ' . ucfirst(str_replace('_', ' ', $qdn->pe_disposition)) : null),
                'corrective_action' => $qdn->capa_corrective_what ?: null,
                'systemic_deployment' => "Occurred {$occurrences}× (" . ($occurrences > 1 ? 'recurring' : 'first occurrence') . ')',
                'effectiveness_verification' => $qdn->qa_capa_implemented
                    ? strtoupper($qdn->qa_capa_implemented) . ($qdn->qa_verification_remarks ? " — {$qdn->qa_verification_remarks}" : '')
                    : null,
                'closure_evidence' => ($qdn->status === Qdn::STATUS_CLOSED && $qdn->qa_verified_by)
                    ? "{$qdn->qa_verified_by} on {$formatDate($qdn->qa_verified_at)}"
                    : null,
            ];

            $elements = [
                'problem_description' => $details['problem_description'] ? 'yes' : 'no',
                'where_when' => $details['where_when'] ? 'yes' : 'no',
                'magnitude' => $details['magnitude'] ? 'yes' : 'no',
                'containment' => $details['containment'] ? 'yes' : 'no',
                'rca_occurrence' => $details['rca_occurrence'] ? 'yes' : 'no',
                'rca_escape' => $details['rca_escape'] ? 'yes' : 'no',
                'rca_validation' => $details['rca_validation'] ? 'yes' : 'no',
                'corrective_action' => $details['corrective_action'] ? 'yes' : 'no',
                'systemic_deployment' => $occurrences > 1 ? 'yes' : 'no',
                'effectiveness_verification' => $details['effectiveness_verification'] ? 'yes' : 'no',
                'closure_evidence' => $details['closure_evidence'] ? 'yes' : 'no',
            ];
            $weight = ['yes' => 1, 'no' => 0];
            $score = array_sum(array_map(fn ($v) => $weight[$v], $elements));

            return [
                'id' => $qdn->id,
                'qdn_no' => $qdn->qdn_no,
                'status_label' => $qdn->statusLabel(),
                'elements' => $elements,
                'details' => $details,
                'completion_percent' => round(($score / count($elements)) * 100, 1),
            ];
        });

        return Inertia::render('Qdn/Compliance/Index', [
            'qdns' => $qdns,
            'elementLabels' => self::COMPLIANCE_ELEMENTS,
            'filters' => $request->only(['q']),
        ]);
    }

    /**
     * Corrective Action Tracker -- every containment lot, correction row,
     * and corrective-action record, in one paginated/searchable list
     * (mirrors the Excel "Corrective Action Tracker" tab). Built as a
     * UNION across the three source tables rather than three separate
     * lists -- Laravel's paginate() supports union queries directly (it
     * wraps the whole thing in a COUNT(*) subquery for the total), so
     * this stays a single indexed, paginated query rather than pulling
     * everything into PHP to merge and sort.
     */
    public function correctiveActionTracker(Request $request): Response
    {
        $term = trim((string) $request->query('q', ''));

        $containment = DB::table('qdn_capa_containment_lots as l')
            ->join('qdns as q', 'q.id', '=', 'l.qdn_id')
            ->whereColumn('l.round', 'q.capa_round')
            ->select([
                'q.id as qdn_id', 'q.qdn_no',
                DB::raw("'Containment' as action_type"),
                DB::raw("CONCAT('Lot ', COALESCE(l.lot_id, '—'), ' - ', COALESCE(l.part_name, ''), ' (qty ', COALESCE(l.qty, 0), ')') as action_description"),
                DB::raw('NULL as root_cause_addressed'),
                'l.inspected_by_name as responsible_owner',
                'l.date_processed as target_date',
                'l.status',
                'l.remarks as implementation_evidence',
                DB::raw('NULL as effectiveness_measure'),
                DB::raw('NULL as verification_date'),
                DB::raw('NULL as qa_qms_result'),
                'q.created_at',
            ]);

        $corrections = DB::table('qdn_capa_corrections as c')
            ->join('qdns as q', 'q.id', '=', 'c.qdn_id')
            ->whereColumn('c.round', 'q.capa_round')
            ->select([
                'q.id as qdn_id', 'q.qdn_no',
                DB::raw("'Correction' as action_type"),
                'c.activity as action_description',
                DB::raw('NULL as root_cause_addressed'),
                DB::raw('COALESCE(c.supervisor_employee_name, c.operator_employee_name) as responsible_owner'),
                'c.work_date as target_date',
                DB::raw('NULL as status'),
                'c.remarks as implementation_evidence',
                DB::raw('NULL as effectiveness_measure'),
                DB::raw('NULL as verification_date'),
                DB::raw('NULL as qa_qms_result'),
                'q.created_at',
            ]);

        $corrective = DB::table('qdns as q')
            ->whereNotNull('q.capa_corrective_what')
            ->where('q.capa_corrective_what', '!=', '')
            ->select([
                'q.id as qdn_id', 'q.qdn_no',
                DB::raw("'Corrective Action' as action_type"),
                'q.capa_corrective_what as action_description',
                DB::raw('NULL as root_cause_addressed'),
                'q.capa_corrective_responsible_name as responsible_owner',
                'q.capa_corrective_when as target_date',
                'q.capa_corrective_status as status',
                DB::raw('NULL as implementation_evidence'),
                'q.qa_verification_remarks as effectiveness_measure',
                'q.qa_verified_at as verification_date',
                DB::raw("CASE WHEN q.qa_capa_implemented = 'yes' THEN 'Effective' WHEN q.qa_capa_implemented = 'no' THEN 'Not Effective - Returned' ELSE 'Pending Verification' END as qa_qms_result"),
                'q.created_at',
            ]);

        if ($term !== '') {
            $containment->where('q.qdn_no', 'like', "%{$term}%");
            $corrections->where('q.qdn_no', 'like', "%{$term}%");
            $corrective->where('q.qdn_no', 'like', "%{$term}%");
        }

        $actions = $containment->unionAll($corrections)
            ->unionAll($corrective)
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Qdn/CorrectiveActionTracker/Index', [
            'actions' => $actions,
            'filters' => $request->only(['q']),
        ]);
    }

    /**
     * Effectiveness Verification -- every QDN that has reached (or passed)
     * QA Verification, one row per QDN (mirrors the Excel "Effectiveness
     * Verification" tab). Baseline Result / Target-Acceptance Criteria /
     * Monitoring Period have no backing fields in this schema -- left
     * null here rather than invented, same as the Excel report's caveat.
     */
    public function effectivenessVerification(Request $request): Response
    {
        $term = trim((string) $request->query('q', ''));
        $resultMet = $request->query('result_met');

        $query = Qdn::query()->where(function ($q) {
            $q->whereIn('status', [Qdn::STATUS_FOR_QA_VERIFICATION, Qdn::STATUS_CLOSED])
                ->orWhereNotNull('qa_capa_implemented');
        });

        if ($term !== '') {
            $query->where('qdn_no', 'like', "%{$term}%");
        }

        if (in_array($resultMet, ['yes', 'no'], true)) {
            $query->where('qa_capa_implemented', $resultMet);
        }

        $rows = $query->orderByDesc('qa_verified_at')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Qdn $qdn) => [
                'id' => $qdn->id,
                'qdn_no' => $qdn->qdn_no,
                'problem_kpi' => $qdn->nonconformity_name,
                'post_action_result' => $qdn->qa_verification_remarks,
                'result_met' => $qdn->qa_capa_implemented,
                'verified_by' => $qdn->qa_verified_by,
                'verification_date' => $qdn->qa_verified_at,
                'closure_recommendation' => $qdn->status === Qdn::STATUS_CLOSED
                    ? 'Closed - Verified Effective'
                    : ($qdn->qa_capa_implemented === 'no' ? 'Return to CAPA' : 'Pending'),
            ]);

        return Inertia::render('Qdn/EffectivenessVerification/Index', [
            'rows' => $rows,
            'filters' => $request->only(['q', 'result_met']),
        ]);
    }

    /**
     * Full QDN record list -- every QDN ever created, every summary field,
     * current stage. This is the "qdn_record list listing all information"
     * you asked for. Not department-scoped: it's a full history view, same
     * as the individual record page below shows every field for one QDN.
     */
    // Sortable columns, whitelisted -- $request->query('sort') is never
    // passed straight to orderBy() (that would let a crafted query string
    // sort by an arbitrary/nonexistent column).
    private const RECORDS_SORTABLE = [
        'qdn_no', 'customer_name', 'device_name', 'detection_area',
        'nonconformity_name', 'classification', 'status',
        'issued_department', 'created_at',
    ];

    // "Toggle (pending, closed valid, invalid)" -- three buckets, every
    // status in exactly one:
    //   - Pending: still ongoing / actively moving through the workflow
    //     (nothing terminal yet).
    //   - Valid: "closed valid" -- reached STATUS_CLOSED, which in this
    //     workflow only ever happens via QA Verification's "Corrective
    //     Action implemented? Yes" (QdnWorkflowController@qaStore). Per
    //     the user: "if the QDN Status is QA Verified Implemented Yes
    //     then its considered as closed valid then should go to valid,
    //     all closed valid should go to valid."
    //   - Invalid: PE rejected it outright, or PE's post-RCA disposition
    //     was Invalid -- closed, but never successfully completed.
    private const RECORDS_STATUS_GROUPS = [
        'pending' => [
            Qdn::STATUS_PENDING_PE,
            Qdn::STATUS_ISSUED,
            Qdn::STATUS_FOR_DEPT_RCA,
            Qdn::STATUS_FOR_PE_RCA_VALIDATION,
            Qdn::STATUS_FOR_DEPT_CAPA,
            Qdn::STATUS_FOR_DEPT_APPROVAL,
            Qdn::STATUS_FOR_QA_VERIFICATION,
        ],
        'valid' => [Qdn::STATUS_CLOSED],
        'invalid' => [Qdn::STATUS_INVALID, Qdn::STATUS_INVALID_DISPOSITION],
    ];

    /**
     * Full QDN record list -- searchable, filterable, sortable, paginated.
     * Not department-scoped: full history view across every QDN. The
     * "Work Week" filter is keyed off the company's own analog_calendar
     * table -- see the workweek handling below and App\Models\AnalogCalendar.
     */
    public function records(Request $request): Response
    {
        $sort = in_array($request->query('sort'), self::RECORDS_SORTABLE, true)
            ? $request->query('sort')
            : 'created_at';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';

        $query = Qdn::query();

        // Search engine -- one text box across the fields someone would
        // actually recognize a QDN by.
        $term = trim((string) $request->query('q', ''));
        if ($term !== '') {
            $query->where(function ($w) use ($term) {
                $w->where('qdn_no', 'like', "%{$term}%")
                    ->orWhere('customer_name', 'like', "%{$term}%")
                    ->orWhere('device_name', 'like', "%{$term}%")
                    ->orWhere('package_name', 'like', "%{$term}%")
                    ->orWhere('issued_by', 'like', "%{$term}%")
                    ->orWhere('issued_department', 'like', "%{$term}%");
            });
        }

        $statusGroup = $request->query('status_group');
        if ($statusGroup && isset(self::RECORDS_STATUS_GROUPS[$statusGroup])) {
            $query->whereIn('status', self::RECORDS_STATUS_GROUPS[$statusGroup]);
        }

        // "Work Week" -- filters by the company's own analog_calendar
        // calendar (one row per calendar day tagged with cal_year/
        // cal_workweek, see App\Models\AnalogCalendar), not a generic
        // rolling "last 7 days." The selected value is "{cal_year}-
        // {cal_workweek}" (e.g. "2026-34"); MIN/MAX(cal_date) for that
        // pair gives the actual date range, checked against the QDN's
        // issuance date (created_at). Wins over an explicit date range if
        // both are somehow submitted at once (the UI only ever sends one
        // or the other).
        $workWeek = trim((string) $request->query('workweek', ''));
        if ($workWeek !== '') {
            [$year, $ww] = array_pad(explode('-', $workWeek, 2), 2, null);
            $range = AnalogCalendar::query()
                ->where('cal_year', $year)
                ->where('cal_workweek', $ww)
                ->selectRaw('MIN(cal_date) as date_start, MAX(cal_date) as date_end')
                ->first();
            if ($range?->date_start && $range?->date_end) {
                $query->whereBetween('created_at', [
                    Carbon::parse($range->date_start)->startOfDay(),
                    Carbon::parse($range->date_end)->endOfDay(),
                ]);
            }
        } else {
            // Same sargability fix as dashboard() above -- plain range
            // comparisons on created_at instead of whereDate(), so this
            // can actually use qdns_created_at_index / qdns_status_created_at_index
            // once qdns has 100k+ rows.
            if ($request->filled('date_from')) {
                $query->where('created_at', '>=', Carbon::parse($request->query('date_from'))->startOfDay());
            }
            if ($request->filled('date_to')) {
                $query->where('created_at', '<=', Carbon::parse($request->query('date_to'))->endOfDay());
            }
        }

        if ($request->filled('detection_area')) {
            $query->where('detection_area', $request->query('detection_area'));
        }

        if ($request->filled('nonconformity_id')) {
            $query->where('nonconformity_id', $request->query('nonconformity_id'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->query('customer_id'));
        }

        $qdns = $query->orderBy($sort, $direction)
            ->paginate(20)
            ->withQueryString();

        // Failure Mode (defect_source) -- a QDN's RCA causes can each
        // carry a different Source of Defect (Man/Machine/Materials/
        // Method/Environment/Systems); this shows every distinct one
        // recorded so far for that QDN, comma-separated. Blank until RCA
        // has been submitted (nothing to show yet).
        $qdns->getCollection()->load('rcaCauses:id,qdn_id,defect_source_name');

        $qdns->through(fn (Qdn $qdn) => array_merge($qdn->toArray(), [
            'status_label' => $qdn->statusLabel(),
            'failure_modes' => $qdn->rcaCauses
                ->pluck('defect_source_name')
                ->filter()
                ->unique()
                ->values()
                ->implode(', '),
        ]));

        return Inertia::render('Qdn/Records/Index', [
            'qdns' => $qdns,
            'filters' => $request->only([
                'q', 'status_group', 'date_from', 'date_to', 'workweek',
                'detection_area', 'nonconformity_id', 'customer_id', 'sort', 'direction',
            ]),
            'filterOptions' => [
                // Free-text field (no lookup table backs it), so the
                // dropdown is built from whatever values already exist in
                // the data rather than an exhaustive predefined list.
                'detectionAreas' => Qdn::whereNotNull('detection_area')
                    ->where('detection_area', '!=', '')
                    ->distinct()
                    ->orderBy('detection_area')
                    ->pluck('detection_area'),
                'nonconformities' => Nonconformity::orderBy('nonconformity_name')
                    ->get(['id', 'nonconformity_name']),
                'customers' => Customer::orderBy('customer_name')->get(['id', 'customer_name']),
                // Every (cal_year, cal_workweek) pair that exists in the
                // calendar, newest first, each carrying the actual date
                // range so the dropdown can show "WW34 · 2026 (Aug 18–24)"
                // instead of a bare number.
                'workWeeks' => AnalogCalendar::query()
                    ->selectRaw('cal_year, cal_workweek, MIN(cal_date) as date_start, MAX(cal_date) as date_end')
                    ->groupBy('cal_year', 'cal_workweek')
                    ->orderByDesc('cal_year')
                    ->orderByDesc('cal_workweek')
                    ->get()
                    ->map(fn ($w) => [
                        'value' => "{$w->cal_year}-{$w->cal_workweek}",
                        'year' => $w->cal_year,
                        'workweek' => $w->cal_workweek,
                        'date_start' => $w->date_start,
                        'date_end' => $w->date_end,
                    ]),
            ],
        ]);
    }

    /**
     * Every field for a single QDN -- base details plus whatever RCA/CAPA/
     * QA Verification data has been recorded so far, plus the original PE
     * valid/invalid decision (issued_to_name/department/etc., via the
     * qdn_validations relation).
     */
    public function recordShow(Qdn $qdn): Response
    {
        return Inertia::render('Qdn/Records/Show', [
            'qdn' => array_merge(
                $qdn->load(['validation', 'rcaCauses', 'capaContainmentLots', 'capaCorrections'])->toArray(),
                ['status_label' => $qdn->statusLabel()]
            ),
        ]);
    }
}
