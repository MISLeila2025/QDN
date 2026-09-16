<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQdnValidationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // restrict to Department: PE once auth/roles are wired up
    }

    public function rules(): array
    {
        return [
            'is_valid' => ['required', 'boolean'],
            // Issued To is only required when the QDN is marked valid
            'issued_to_employee_id' => ['required_if:is_valid,true', 'nullable', 'string'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
