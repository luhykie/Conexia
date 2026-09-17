<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentReviewItem extends Model
{
    use HasUuids;

    protected $fillable = ['document_id', 'review_version', 'document_file_id', 'department_id', 'author_id', 'parent_id', 'type', 'display_number', 'highlight_color', 'highlight_removed_at', 'confirmed_at', 'selected_text', 'selection_anchor', 'comment'];

    // Casts annotation geometry and review timestamps to usable values.
    protected function casts(): array { return ['selection_anchor' => 'array', 'highlight_removed_at' => 'datetime', 'confirmed_at' => 'datetime']; }

    // Returns the department responsible for this review item.
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    // Returns the profile that created this review item.
    public function author(): BelongsTo { return $this->belongsTo(Profile::class, 'author_id'); }
    // Returns the parent item when this record is a reply.
    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
}
