<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQdnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // wire up auth/role checks once SSO is integrated
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer'],
            'lot_id' => ['required', 'string', 'max:100'],
            'lot_qty' => ['required', 'integer', 'min:1'],
            'device_name' => ['required', 'string', 'max:150'],
            'machine_id' => ['required', 'integer'],
            'location_id' => ['required', 'integer'],
            'detected_at' => ['required', 'date'],
            'nonconformity_id' => ['required', 'integer'],
            'details' => ['required', 'string'],
            // No longer accepted from the client -- QdnController@store sets
            // issued_by from the authenticated user (auth()->user()->name).
        ];
    }
}
