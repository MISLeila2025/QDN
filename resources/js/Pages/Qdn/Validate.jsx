import { useForm, Head } from "@inertiajs/react";
import EmployeeSearchSelect from "@/Components/EmployeeSearchSelect";
import BackLink from "@/Components/BackLink";

/**
 * Step 2 — Validate by Department: PE.
 * Props (from PeValidationController@show): qdn
 */
export default function Validate({ qdn }) {
    const { data, setData, post, processing, errors } = useForm({
        is_valid: null, // true | false
        issued_to_employee_id: "",
        issued_to_name: "",
        department: "",
        station: "",
        prodline: "",
        team: "",
        validated_by: "",
        remarks: "",
    });

    // "Issued To" is a server-side type-ahead now (EmployeeSearchSelect ->
    // GET /employees/search, unscoped -- company-wide) instead of a
    // preloaded dropdown of the entire employee_masterlist. Selecting
    // fills Department/Station/ProdLine/Team in immediately from the
    // search result, no extra request needed (the old /pe/employee-lookup
    // round trip stays unused, same as before).
    function handleEmployeeSelect(employee) {
        setData((prev) => ({
            ...prev,
            issued_to_employee_id: employee?.EMPLOYID ?? "",
            issued_to_name: employee?.EMPLOYNAME ?? "",
            department: employee?.DEPARTMENT ?? "",
            station: employee?.STATION ?? "",
            prodline: employee?.PRODLINE ?? "",
            team: employee?.TEAM ?? "",
        }));
    }

    function setValid(value) {
        // Valid / Invalid are mutually exclusive, so selecting one clears
        // the other even though the spec calls them "checkboxes".
        setData("is_valid", value);
    }

    function handleSubmit(e) {
        e.preventDefault();
        post(`/pe/qdn/${qdn.id}/validate`);
    }

    return (
        <div className="qdn-page">
            <Head title={`Validate ${qdn.qdn_no}`} />
            <BackLink href="/pe/qdn" label="Back to PE Validation Queue" />
            <h1>Validate QDN — {qdn.qdn_no}</h1>

            <section className="qdn-readonly-summary">
                <h2>Details of Issuance</h2>
                <dl>
                    <dt>Customer</dt>
                    <dd>{qdn.customer_name}</dd>
                    <dt>Lot ID</dt>
                    <dd>{qdn.lot_id}</dd>
                    <dt>Lot Qty</dt>
                    <dd>{qdn.lot_qty}</dd>
                    <dt>Device Name</dt>
                    <dd>{qdn.device_name}</dd>
                    <dt>Package Name</dt>
                    <dd>{qdn.package_name}</dd>
                    <dt>Machine No</dt>
                    <dd>{qdn.machine_num}</dd>
                    <dt>Detection Area</dt>
                    <dd>{qdn.detection_area}</dd>
                    <dt>Date &amp; Time of Detection</dt>
                    <dd>{new Date(qdn.detected_at).toLocaleString()}</dd>
                    <dt>Type of Non-Conformity / Failure Mode</dt>
                    <dd>{qdn.nonconformity_name}</dd>
                    <dt>Classification</dt>
                    <dd>{qdn.classification}</dd>
                </dl>

                <h3>Details of Non-Conformity / Failure Mode</h3>
                <div
                    className="qdn-rte-content qdn-readonly-html"
                    dangerouslySetInnerHTML={{ __html: qdn.details }}
                />
            </section>

            <form onSubmit={handleSubmit} className="qdn-form">
                <div className="qdn-field">
                    <label>Validation</label>
                    <div className="qdn-checkbox-row">
                        <label className="qdn-checkbox">
                            <input
                                type="checkbox"
                                checked={data.is_valid === true}
                                onChange={() => setValid(true)}
                            />
                            Valid
                        </label>
                        <label className="qdn-checkbox">
                            <input
                                type="checkbox"
                                checked={data.is_valid === false}
                                onChange={() => setValid(false)}
                            />
                            Invalid
                        </label>
                    </div>
                    {errors.is_valid && (
                        <p className="qdn-field-error">{errors.is_valid}</p>
                    )}
                </div>

                {data.is_valid && (
                    <>
                        <div className="qdn-field">
                            <label htmlFor="issued_to_employee_id">
                                Issued To
                            </label>
                            <EmployeeSearchSelect
                                value={
                                    data.issued_to_employee_id
                                        ? {
                                              EMPLOYID:
                                                  data.issued_to_employee_id,
                                              EMPLOYNAME: data.issued_to_name,
                                              DEPARTMENT: data.department,
                                          }
                                        : null
                                }
                                onChange={handleEmployeeSelect}
                            />
                            {errors.issued_to_employee_id && (
                                <p className="qdn-field-error">
                                    {errors.issued_to_employee_id}
                                </p>
                            )}
                        </div>

                        <div className="qdn-field">
                            <label>Department</label>
                            <input
                                type="text"
                                value={data.department}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="qdn-field">
                            <label>Station</label>
                            <input
                                type="text"
                                value={data.station}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="qdn-field">
                            <label>Product Line</label>
                            <input
                                type="text"
                                value={data.prodline}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="qdn-field">
                            <label>Team Responsible</label>
                            <input
                                type="text"
                                value={data.team}
                                disabled
                                readOnly
                            />
                        </div>
                    </>
                )}

                <div className="qdn-field qdn-field-wide">
                    <label htmlFor="remarks">Remarks</label>
                    <textarea
                        id="remarks"
                        value={data.remarks}
                        onChange={(e) => setData("remarks", e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing || data.is_valid === null}
                >
                    Submit
                </button>
            </form>
        </div>
    );
}
