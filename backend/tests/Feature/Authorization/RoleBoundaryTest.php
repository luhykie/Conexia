<?php

namespace Tests\Feature\Authorization;

use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class RoleBoundaryTest extends SecurityTestCase
{
    public function test_legal_routes_allow_only_legal_counsel(): void
    {
        $this->getJson(
            '/api/legal/documents/review',
            $this->authHeaders($this->profile(Profile::ROLE_LEGAL_COUNSEL))
        )->assertOk();

        foreach ([
            Profile::ROLE_DEPARTMENT_STAFF,
            Profile::ROLE_IRO_STAFF,
            Profile::ROLE_IRO_ADMIN,
            Profile::ROLE_SUPER_ADMIN,
        ] as $role) {
            $this->getJson(
                '/api/legal/documents/review',
                $this->authHeaders($this->profile($role))
            )->assertForbidden();
        }
    }

    public function test_department_document_routes_allow_only_department_staff(): void
    {
        $department = $this->department();

        $this->getJson(
            '/api/department/documents',
            $this->authHeaders($this->profile(
                Profile::ROLE_DEPARTMENT_STAFF,
                ['department_id' => $department->id]
            ))
        )->assertOk();

        foreach ([
            Profile::ROLE_LEGAL_COUNSEL,
            Profile::ROLE_IRO_STAFF,
            Profile::ROLE_IRO_ADMIN,
            Profile::ROLE_SUPER_ADMIN,
        ] as $role) {
            $this->getJson(
                '/api/department/documents',
                $this->authHeaders($this->profile($role))
            )->assertForbidden();
        }
    }

    public function test_iro_routes_allow_iro_staff_and_iro_admin_only(): void
    {
        foreach ([
            Profile::ROLE_IRO_STAFF,
            Profile::ROLE_IRO_ADMIN,
        ] as $role) {
            $this->getJson(
                '/api/iro/documents/incoming',
                $this->authHeaders($this->profile($role))
            )->assertOk();
        }

        foreach ([
            Profile::ROLE_DEPARTMENT_STAFF,
            Profile::ROLE_LEGAL_COUNSEL,
            Profile::ROLE_SUPER_ADMIN,
        ] as $role) {
            $this->getJson(
                '/api/iro/documents/incoming',
                $this->authHeaders($this->profile($role))
            )->assertForbidden();
        }
    }

    public function test_notification_routes_exclude_super_admin(): void
    {
        foreach ([
            Profile::ROLE_DEPARTMENT_STAFF,
            Profile::ROLE_IRO_STAFF,
            Profile::ROLE_IRO_ADMIN,
            Profile::ROLE_LEGAL_COUNSEL,
        ] as $role) {
            $this->getJson(
                '/api/notifications',
                $this->authHeaders($this->profile($role))
            )->assertOk();
        }

        $this->getJson(
            '/api/notifications',
            $this->authHeaders($this->profile(Profile::ROLE_SUPER_ADMIN))
        )->assertForbidden();
    }
}
