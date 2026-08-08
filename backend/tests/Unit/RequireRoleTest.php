<?php

namespace Tests\Unit;

use App\Http\Middleware\RequireRole;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RequireRoleTest extends TestCase
{
    public function test_group_schema_admin_role_is_authorized_as_iro_admin(): void
    {
        $request = Request::create('/api/iro-admin/overview');
        $request->attributes->set('auth_profile', (object) [
            'role' => 'admin',
            'role_key' => 'admin',
        ]);

        $response = app(RequireRole::class)->handle(
            $request,
            fn (): Response => new Response('ok'),
            'iro_admin'
        );

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_canonical_iro_admin_role_remains_authorized(): void
    {
        $request = Request::create('/api/iro-admin/overview');
        $request->attributes->set('auth_profile', (object) [
            'role' => 'iro_admin',
            'role_key' => 'admin',
        ]);

        $response = app(RequireRole::class)->handle(
            $request,
            fn (): Response => new Response('ok'),
            'iro_admin'
        );

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_staff_cannot_access_iro_admin_route(): void
    {
        $this->expectException(HttpException::class);

        $request = Request::create('/api/iro-admin/overview');
        $request->attributes->set('auth_profile', (object) [
            'role' => 'staff',
            'role_key' => 'staff',
        ]);

        app(RequireRole::class)->handle(
            $request,
            fn (): Response => new Response('ok'),
            'iro_admin'
        );
    }
}
