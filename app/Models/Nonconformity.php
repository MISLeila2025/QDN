<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: nonconformity_list, copied one-time from qdn_db into your
 * app's default connection (qdn_new_db) via
 * app/Console/Commands/CopyQdnLookupTables.php.
 * Per spec: nonconformity_name, and nonconformity_category where
 * 1 = Minor, 2 = Major, 3 = Critical.
 */
class Nonconformity extends Model
{

    protected $table = 'nonconformity_list';

    public $timestamps = false;

    protected $guarded = [];

    public const CATEGORY_MINOR = 1;
    public const CATEGORY_MAJOR = 2;
    public const CATEGORY_CRITICAL = 3;

    public const CATEGORY_LABELS = [
        self::CATEGORY_MINOR => 'Minor',
        self::CATEGORY_MAJOR => 'Major',
        self::CATEGORY_CRITICAL => 'Critical',
    ];

    /**
     * Normalizes nonconformity_category to a plain 1/2/3 int, regardless of
     * whether the stored value is an integer (1), a numeric string ("1"),
     * or a "N-Label" string like "1-Minor" (per the original spec's literal
     * wording: "1-Minor, 2-Major, 3-Critical"). A regex extraction here
     * instead of an exact-match lookup keeps this working whichever format
     * the real qdn_db data turns out to use.
     */
    public function categoryNumber(): ?int
    {
        if ($this->nonconformity_category === null || $this->nonconformity_category === '') {
            return null;
        }

        if (preg_match('/\d+/', (string) $this->nonconformity_category, $matches) !== 1) {
            return null;
        }

        $number = (int) $matches[0];

        return array_key_exists($number, self::CATEGORY_LABELS) ? $number : null;
    }

    public function classificationLabel(): ?string
    {
        $number = $this->categoryNumber();

        return $number !== null ? self::CATEGORY_LABELS[$number] : null;
    }
}
