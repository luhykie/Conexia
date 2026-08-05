<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\Submission;

class SubmissionWorkflowService
{
    // Include both canonical role keys and development token variants
    private const FILE_VISIBLE_ROLES = [
        'iro_admin', // canonical
        'legal',
        // dev / alternate role_key variants seen in local tokens
        'admin',
    ];

    public function canViewFile(Profile $profile, Submission $submission): bool
    {
        return $submission->submitted_by === $profile->id || in_array($profile->role_key, self::FILE_VISIBLE_ROLES, true);
    }
}
