<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration { public function up(): void { Schema::create('document_discussion_messages', function (Blueprint $table): void { $table->uuid('id')->primary(); $table->uuid('document_id')->index(); $table->unsignedInteger('review_version')->default(1); $table->uuid('department_id')->index(); $table->uuid('author_id')->index(); $table->text('message'); $table->timestamps(); }); } public function down(): void { Schema::dropIfExists('document_discussion_messages'); } };
