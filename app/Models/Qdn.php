<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Qdn extends Model
{
    // Default connection -- now qdn_new_db (via DB_DATABASE in .env),
    // alongside the copied customer_list/package_list/machine_list/
    // location_list/nonconformity_list, and your users/sessions tables.

    protected $fillable = [
        'qdn_no',
        'customer_id',
        'customer_name',
        'lot_id',
        'lot_qty',
        'device_name',
        'package_name',
        'machine_id',
        'machine_num',
        'location_id',
        'detection_area',
        'detected_at',
        'nonconformity_id',
        'nonconformity_name',
        'nonconformity_category',
        'classification',
        'details',
        'status',
        'issued_department',
        'issued_by',
        'rca_details',
        'rca_submitted_by',
        'rca_submitted_at',
        'rca_validated_by',
        'rca_validated_at',
        'rca_validation_remarks',
        'pe_disposition',
        'pe_disposition_remarks',
        'pe_disposition_by',
        'pe_disposition_at',
        'capa_details',
        'capa_submitted_by',
        'capa_submitted_at',
        'capa_approved_by',
        'capa_approved_at',
        'capa_approval_remarks',
        'capa_approval_status',
        'capa_round',
        'qa_verified_by',
        'qa_verified_at',
        'qa_verification_remarks',
        'qa_capa_implemented',
        'capa_containment_checked',
        'capa_correction_checked',
        'capa_corrective_what',
        'capa_corrective_responsible_employee_id',
        'capa_corrective_responsible_name',
        'capa_corrective_when',
        'capa_corrective_status',
    ];

    protected $casts = [
        'detected_at' => 'datetime',
        'lot_qty' => 'integer',
        'nonconformity_category' => 'integer',
        'rca_submitted_at' => 'datetime',
        'rca_validated_at' => 'datetime',
        'pe_disposition_at' => 'datetime',
        'capa_submitted_at' => 'datetime',
        'capa_approved_at' => 'datetime',
        'qa_verified_at' => 'datetime',
        'capa_containment_checked' => 'boolean',
        'capa_correction_checked' => 'boolean',
        'capa_corrective_when' => 'date',
        'capa_round' => 'integer',
    ];

    public const STATUS_PENDING_PE = 'pending_pe';
    // Legacy -- rows already in this state from before the workflow was
    // expanded. New QDNs marked valid now go straight to
    // STATUS_FOR_DEPT_RCA instead (see PeValidationController@store).
    public const STATUS_ISSUED = 'issued';
    public const STATUS_INVALID = 'invalid';
    public const STATUS_FOR_DEPT_RCA = 'for_dept_rca';
    public const STATUS_FOR_PE_RCA_VALIDATION = 'for_pe_rca_validation';
    public const STATUS_FOR_DEPT_CAPA = 'for_dept_capa';
    public const STATUS_FOR_DEPT_APPROVAL = 'for_dept_approval';
    public const STATUS_FOR_QA_VERIFICATION = 'for_qa_verification';
    public const STATUS_CLOSED = 'closed';
    // PE's post-RCA disposition was "Invalid" -- distinct from
    // STATUS_INVALID, which means PE rejected the QDN at the very first
    // pending_pe step, before any department ever touched it. A QDN
    // reaching this status has already been through RCA; it closes here
    // (no CAPA) but stays fully visible in QDN Records / the department's
    // history, same as every other terminal status. See
    // QdnWorkflowController@peRcaStore.
    public const STATUS_INVALID_DISPOSITION = 'invalid_disposition';

    public const STATUS_LABELS = [
        self::STATUS_PENDING_PE => 'For PE Validation and Assigning',
        self::STATUS_ISSUED => 'Issued',
        self::STATUS_INVALID => 'Invalid',
        self::STATUS_FOR_DEPT_RCA => 'For Dept RCA',
        self::STATUS_FOR_PE_RCA_VALIDATION => 'For PE Validation of RCA',
        self::STATUS_FOR_DEPT_CAPA => 'For Department CAPA',
        self::STATUS_FOR_DEPT_APPROVAL => 'For Dept Approval',
        self::STATUS_FOR_QA_VERIFICATION => 'For QA Verification',
        self::STATUS_CLOSED => 'Closed',
        self::STATUS_INVALID_DISPOSITION => 'Invalid Disposition',
    ];

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    // PE Disposition (after RCA) -- exactly one of these six, recorded on
    // QdnWorkflowController@peRcaStore. Everything except DISPOSITION_INVALID
    // routes the QDN back to its issued_department for CAPA;
    // DISPOSITION_INVALID closes it (STATUS_INVALID_DISPOSITION) instead.
    public const DISPOSITION_REWORK = 'rework';
    public const DISPOSITION_SPLIT_LOT = 'split_lot';
    public const DISPOSITION_SHUTDOWN = 'shutdown';
    public const DISPOSITION_SHIPBACK = 'shipback';
    public const DISPOSITION_USE_AS_IS = 'use_as_is';
    public const DISPOSITION_INVALID = 'invalid';

    public const DISPOSITIONS = [
        self::DISPOSITION_REWORK,
        self::DISPOSITION_SPLIT_LOT,
        self::DISPOSITION_SHUTDOWN,
        self::DISPOSITION_SHIPBACK,
        self::DISPOSITION_USE_AS_IS,
        self::DISPOSITION_INVALID,
    ];

    public const DISPOSITION_LABELS = [
        self::DISPOSITION_REWORK => 'Rework',
        self::DISPOSITION_SPLIT_LOT => 'Split Lot',
        self::DISPOSITION_SHUTDOWN => 'Shutdown',
        self::DISPOSITION_SHIPBACK => 'Shipback',
        self::DISPOSITION_USE_AS_IS => 'Use As Is',
        self::DISPOSITION_INVALID => 'Invalid',
    ];

    public function peDispositionLabel(): ?string
    {
        if (!$this->pe_disposition) {
            return null;
        }

        return self::DISPOSITION_LABELS[$this->pe_disposition] ?? $this->pe_disposition;
    }

    // Dept Approval's decision on the current CAPA round -- Correct routes
    // to QA Verification; Wrong logs a QdnCapaReturn (stage=approval),
    // bumps capa_round, and sends the QDN back to STATUS_FOR_DEPT_CAPA.
    // See QdnWorkflowController@approvalStore.
    public const CAPA_APPROVAL_STATUS_CORRECT = 'correct';
    public const CAPA_APPROVAL_STATUS_WRONG = 'wrong';

    // QA Verification's "Corrective Action implemented?" radio -- Yes
    // closes the QDN; No logs a QdnCapaReturn (stage=qa), bumps
    // capa_round, and sends the QDN back to STATUS_FOR_DEPT_CAPA. See
    // QdnWorkflowController@qaStore.
    public const QA_CAPA_IMPLEMENTED_YES = 'yes';
    public const QA_CAPA_IMPLEMENTED_NO = 'no';

    // Statuses "owned" by whichever department the QDN was routed to --
    // the same employee.masterlist DEPARTMENT stored in issued_department.
    // Used by QdnWorkflowController's assertOwningDepartment() guard and by
    // IssuedQdnController's broadened "QDNs for My Department" query.
    public const DEPARTMENT_OWNED_STATUSES = [
        self::STATUS_FOR_DEPT_RCA,
        self::STATUS_FOR_DEPT_CAPA,
        self::STATUS_FOR_DEPT_APPROVAL,
    ];

    // Every status a QDN can sit in once it's been routed to a department,
    // i.e. anything the receiving department should be able to see on its
    // "QDNs for My Department" page -- its own action queues plus the
    // read-only in-between/final states.
    public const DEPARTMENT_VISIBLE_STATUSES = [
        self::STATUS_ISSUED,
        self::STATUS_FOR_DEPT_RCA,
        self::STATUS_FOR_PE_RCA_VALIDATION,
        self::STATUS_FOR_DEPT_CAPA,
        self::STATUS_FOR_DEPT_APPROVAL,
        self::STATUS_FOR_QA_VERIFICATION,
        self::STATUS_CLOSED,
        // PE's post-RCA "Invalid" disposition also closes the QDN, but the
        // department already did RCA work on it -- unlike STATUS_INVALID
        // (rejected before any department saw it), this one stays in their
        // history.
        self::STATUS_INVALID_DISPOSITION,
    ];

    // Same-connection relations now that qdns lives in qdn_db too.
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class, 'machine_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function nonconformity(): BelongsTo
    {
        return $this->belongsTo(Nonconformity::class, 'nonconformity_id');
    }

    public function validation(): HasOne
    {
        return $this->hasOne(QdnValidation::class);
    }

    // Structured RCA -- Root Cause of Event / Escape / System Cause rows,
    // see QdnRcaCause::TYPE_* and QdnWorkflowController@rcaShow/rcaStore.
    public function rcaCauses(): HasMany
    {
        return $this->hasMany(QdnRcaCause::class)->orderBy('sort_order');
    }

    // Structured CAPA -- Containment Action rows ("Insert 3 lots before
    // and after"), only meaningful when capa_containment_checked is true.
    // Every round's rows are kept (never deleted on resubmission -- see
    // QdnWorkflowController@capaStore), so this includes full history,
    // not just the current round.
    public function capaContainmentLots(): HasMany
    {
        return $this->hasMany(QdnCapaContainmentLot::class)->orderBy('round')->orderBy('sort_order');
    }

    // Structured CAPA -- Correction Action rows ("Rework Traveller"), only
    // meaningful when capa_correction_checked is true. Same full-history
    // note as capaContainmentLots() above.
    public function capaCorrections(): HasMany
    {
        return $this->hasMany(QdnCapaCorrection::class)->orderBy('round')->orderBy('sort_order');
    }

    // Log of every "sent back for CAPA rework" event -- Dept Approval
    // marking a submission Wrong, or QA Verification marking Corrective
    // Action Implemented? No. See QdnCapaReturn.
    public function capaReturns(): HasMany
    {
        return $this->hasMany(QdnCapaReturn::class)->orderBy('created_at');
    }
}
