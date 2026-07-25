<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $table = 'documents';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'tracking_number',
        'title',
        'document_type',
        'partner_institution',
        'partner_email',
        'description',
        'department_id',
        'submitted_by',
        'assigned_iro_staff',
        'assigned_legal_counsel',
        'status',
        'legal_notes',
        'submitted_at',
        'updated_at',
        'notarial_reference_number',
        'notarization_date',
        'notary_signature_code',
        'archived_at',
        'archived_by',
    ];
}