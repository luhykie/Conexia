<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentDiscussionMessage;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentDiscussionController extends Controller
{
 public function index(Request $request, Document $document): JsonResponse { $this->participant($request, $document); return response()->json(['success'=>true,'messages'=>DocumentDiscussionMessage::query()->with(['author','department'])->where('document_id',$document->id)->oldest()->get()->map(fn($m)=>$this->row($m))->values()]); }
 public function store(Request $request, Document $document): JsonResponse { $profile=$this->participant($request,$document); $data=$request->validate(['message'=>['required','string','max:5000']]); $message=DocumentDiscussionMessage::query()->create(['document_id'=>$document->id,'review_version'=>$document->department_review_version,'department_id'=>$profile->department_id,'author_id'=>$profile->id,'message'=>trim($data['message'])]); return response()->json(['success'=>true,'message'=>$this->row($message)]); }
 private function participant(Request $request, Document $document): Profile { $p=$request->attributes->get('authenticated_profile'); if (!$p || !$p->department_id || !$document->partner_department_id || !in_array($p->department_id,[$document->department_id,$document->partner_department_id],true)) abort(403,'Only participating departments can access this discussion.'); if ($p->department_id===$document->partner_department_id && !$document->department_review_routed_at) abort(403,'This submission has not been routed to your department.'); return $p; }
 private function row(DocumentDiscussionMessage $m): array { $m->loadMissing(['author','department']); return ['id'=>$m->id,'message'=>$m->message,'department_id'=>$m->department_id,'department'=>$m->department?->name,'author'=>$m->author?->full_name,'created_at'=>$m->created_at?->toISOString(),'review_version'=>$m->review_version]; }
}
