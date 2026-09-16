<?php

use App\Http\Controllers\DemoController;
use App\Http\Controllers\EmployeeSearchController;
use App\Http\Controllers\IssuedQdnController;
use App\Http\Controllers\PeValidationController;
use App\Http\Controllers\QdnController;
use App\Http\Controllers\QdnWorkflowController;
use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

$app_name = env('APP_NAME', '');

// Authentication routes
require __DIR__ . '/auth.php';

// General routes
require __DIR__ . '/general.php';

Route::get("/demo", [DemoController::class, 'index'])->name('demo');

// --- Step 1: Create QDN -----------------------------------------------
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/qdn/create', [QdnController::class, 'create'])->name('qdn.create');
    Route::post('/qdn', [QdnController::class, 'store'])->name('qdn.store');
    Route::get('/qdn/package-lookup', [QdnController::class, 'packageLookup'])->name('qdn.package-lookup');
    // Landing page after submit -- Pending / Approved (Valid) / Invalid.
    // See QdnController@dashboard for the visibility rules.
    Route::get('/qdn/dashboard', [QdnController::class, 'dashboard'])->name('qdn.dashboard');
});

// --- Step 2: Validate by Department: PE --------------------------------
// Visible/actionable only by employees whose session('emp_data.emp_dept') is "PE".
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/pe/qdn', [PeValidationController::class, 'index'])->name('pe.qdn.index');
    Route::get('/pe/qdn/{qdn}', [PeValidationController::class, 'show'])->name('pe.qdn.show');
    Route::get('/pe/employee-lookup', [PeValidationController::class, 'employeeLookup'])->name('pe.employee-lookup');
    Route::post('/pe/qdn/{qdn}/validate', [PeValidationController::class, 'store'])->name('pe.qdn.store');
});

// --- Step 3: Department view of QDNs issued to it ----------------------
// Once PE marks a QDN valid, everyone in the "Issued To" employee's
// DEPARTMENT can see it here -- same visibility model as the PE queue.
// Covers every stage of the workflow below, not just one status -- see
// IssuedQdnController@index / Qdn::DEPARTMENT_VISIBLE_STATUSES.
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/department/qdn', [IssuedQdnController::class, 'index'])->name('issued.qdn.index');
    Route::get('/department/qdn/{qdn}', [IssuedQdnController::class, 'show'])->name('issued.qdn.show');
});

// --- Step 4: Disposition workflow (after PE marks a QDN valid) ---------
// for_dept_rca -> for_pe_rca_validation -> for_dept_capa
// -> for_dept_approval -> for_qa_verification -> closed
// See QdnWorkflowController for the guard on each stage (owning
// department vs. Department: PE vs. Department: QA).
Route::middleware(AuthMiddleware::class)->group(function () {
    // Dept RCA
    Route::get('/qdn/rca', [QdnWorkflowController::class, 'rcaIndex'])->name('qdn.rca.index');
    Route::get('/qdn/rca/{qdn}', [QdnWorkflowController::class, 'rcaShow'])->name('qdn.rca.show');
    Route::post('/qdn/rca/{qdn}', [QdnWorkflowController::class, 'rcaStore'])->name('qdn.rca.store');

    // PE Validation of RCA
    Route::get('/pe/rca', [QdnWorkflowController::class, 'peRcaIndex'])->name('pe.rca.index');
    Route::get('/pe/rca/{qdn}', [QdnWorkflowController::class, 'peRcaShow'])->name('pe.rca.show');
    Route::post('/pe/rca/{qdn}', [QdnWorkflowController::class, 'peRcaStore'])->name('pe.rca.store');

    // Department CAPA
    Route::get('/qdn/capa', [QdnWorkflowController::class, 'capaIndex'])->name('qdn.capa.index');
    Route::get('/qdn/capa/{qdn}', [QdnWorkflowController::class, 'capaShow'])->name('qdn.capa.show');
    Route::post('/qdn/capa/{qdn}', [QdnWorkflowController::class, 'capaStore'])->name('qdn.capa.store');

    // Dept Approval (of CAPA)
    Route::get('/qdn/approval', [QdnWorkflowController::class, 'approvalIndex'])->name('qdn.approval.index');
    Route::get('/qdn/approval/{qdn}', [QdnWorkflowController::class, 'approvalShow'])->name('qdn.approval.show');
    Route::post('/qdn/approval/{qdn}', [QdnWorkflowController::class, 'approvalStore'])->name('qdn.approval.store');

    // QA Verification
    Route::get('/qa/verification', [QdnWorkflowController::class, 'qaIndex'])->name('qa.verification.index');
    Route::get('/qa/verification/{qdn}', [QdnWorkflowController::class, 'qaShow'])->name('qa.verification.show');
    Route::post('/qa/verification/{qdn}', [QdnWorkflowController::class, 'qaStore'])->name('qa.verification.store');
});

// --- Step 5: Full QDN record list ---------------------------------------
// Every QDN ever created, every field, current stage -- not department
// scoped. See QdnController@records / @recordShow.
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/qdn/records', [QdnController::class, 'records'])->name('qdn.records.index');
    Route::get('/qdn/records/{qdn}', [QdnController::class, 'recordShow'])->name('qdn.records.show');
});

// --- Step 5b: TELFORD standard analysis pages ----------------------------
// Compliance Detail (per-QDN drill-down for the Dashboard's rollup),
// Corrective Action Tracker, and Effectiveness Verification -- see
// QdnController@complianceIndex / @correctiveActionTracker /
// @effectivenessVerification. Not department-scoped, same as Records.
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/qdn/compliance', [QdnController::class, 'complianceIndex'])->name('qdn.compliance.index');
    Route::get('/qdn/corrective-action-tracker', [QdnController::class, 'correctiveActionTracker'])->name('qdn.corrective-action-tracker');
    Route::get('/qdn/effectiveness-verification', [QdnController::class, 'effectivenessVerification'])->name('qdn.effectiveness-verification');
});

// --- Step 6: Server-side employee search --------------------------------
// Backs every "select an employee" picker across the feature (RCA Select
// Responsible / Issued To, PE Validate Issued To, CAPA Inspected By /
// Operator / Supervisor / Corrective Responsible) -- type-ahead by
// EMPLOYID or EMPLOYNAME, queried on demand instead of preloading whole
// rosters into page props. See App\Http\Controllers\EmployeeSearchController
// and resources/js/Components/EmployeeSearchSelect.jsx.
Route::middleware(AuthMiddleware::class)->group(function () {
    Route::get('/employees/search', [EmployeeSearchController::class, 'search'])->name('employees.search');
});

Route::fallback(function () {
    return Inertia::render('404');
})->name('404');