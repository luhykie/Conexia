<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\Submission;

class SubmissionWorkflowService
{
    private const FILE_VISIBLE_ROLES = ['iro_admin', 'legal', 'super_admin'];

    public function canViewFile(Profile $profile, Submission $submission): bool
    {
        return $submission->submitted_by === $profile->id || in_array($profile->role_key, self::FILE_VISIBLE_ROLES, true);
    }
}
