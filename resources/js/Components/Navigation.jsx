import { usePage } from "@inertiajs/react";
import SidebarLink from "@/Components/sidebar/SidebarLink";
import {
    LayoutDashboard,
    FilePlus2,
    ClipboardCheck,
    Inbox,
    LayoutList,
    FlaskConical,
    Wrench,
    Stamp,
    BadgeCheck,
    ListChecks,
    ClipboardList,
    ListTodo,
    ShieldCheck,
} from "lucide-react";

export default function NavLinks({ isSidebarOpen }) {
    const { emp_data } = usePage().props;

    // emp_data.emp_dept, per your AuthMiddleware (session('emp_data') has
    // emp_id/emp_name/emp_dept/emp_station/emp_prodline/etc.) -- NOT
    // emp_data.DEPARTMENT (that key only exists on rows read from
    // employee.masterlist, a different data source than the logged-in
    // user's own session). These hide department-specific links for
    // everyone outside that department -- purely a UX nicety, every route
    // is already guarded server-side (PeValidationController::assertIsPe(),
    // QdnWorkflowController's assertIsPe()/assertIsQa()/assertOwningDepartment(),
    // all of which use the same DEPARTMENT_PE/DEPARTMENT_QA constants as below).
    const normalizedDept = (emp_data?.emp_dept ?? "").trim().toLowerCase();
    const isPe = normalizedDept === "process engineering";
    // QA maps to two distinct real department names, same as
    // CurrentEmployee::DEPARTMENT_QA on the backend.
    const isQa = ["quality assurance", "quality management system"].includes(normalizedDept);

    return (
        <nav
            className="flex flex-col flex-grow space-y-1 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
        >
            <SidebarLink
                href={route("dashboard")}
                label="Dashboard"
                icon={<LayoutDashboard className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.create")}
                label="Create QDN"
                icon={<FilePlus2 className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.dashboard")}
                label="QDN Dashboard"
                icon={<LayoutList className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            {isPe && (
                <SidebarLink
                    href={route("pe.qdn.index")}
                    label="PE Validation Queue"
                    icon={<ClipboardCheck className="w-5 h-5" />}
                    isSidebarOpen={isSidebarOpen}
                />
            )}

            {isPe && (
                <SidebarLink
                    href={route("pe.rca.index")}
                    label="PE: RCA Validation"
                    icon={<ClipboardCheck className="w-5 h-5" />}
                    isSidebarOpen={isSidebarOpen}
                />
            )}

            <SidebarLink
                href={route("qdn.rca.index")}
                label="Dept: RCA"
                icon={<FlaskConical className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.capa.index")}
                label="Dept: CAPA"
                icon={<Wrench className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.approval.index")}
                label="Dept: Approval"
                icon={<Stamp className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            {isQa && (
                <SidebarLink
                    href={route("qa.verification.index")}
                    label="QA Verification"
                    icon={<BadgeCheck className="w-5 h-5" />}
                    isSidebarOpen={isSidebarOpen}
                />
            )}

            <SidebarLink
                href={route("issued.qdn.index")}
                label="QDNs for My Department"
                icon={<Inbox className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.records.index")}
                label="QDN Records"
                icon={<ListChecks className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.compliance.index")}
                label="Compliance Detail"
                icon={<ClipboardList className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.corrective-action-tracker")}
                label="Corrective Action Tracker"
                icon={<ListTodo className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />

            <SidebarLink
                href={route("qdn.effectiveness-verification")}
                label="Effectiveness Verification"
                icon={<ShieldCheck className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
        </nav>
    );
}
