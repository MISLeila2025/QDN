import { usePage } from "@inertiajs/react";
import SidebarLink from "@/Components/sidebar/SidebarLink";
import { LayoutDashboard, FilePlus2, ClipboardCheck, Inbox } from "lucide-react";

export default function NavLinks({ isSidebarOpen }) {
    const { emp_data } = usePage().props;

    // emp_data.emp_dept, per your AuthMiddleware (session('emp_data') has
    // emp_id/emp_name/emp_dept/emp_station/emp_prodline/etc.). This hides
    // the PE Validation link for everyone outside DEPARTMENT: PE -- purely
    // a UX nicety, the route itself is already guarded server-side by
    // PeValidationController::assertIsPe().
    const isPe = emp_data?.emp_dept === "PE";

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

            {isPe && (
                <SidebarLink
                    href={route("pe.qdn.index")}
                    label="PE Validation Queue"
                    icon={<ClipboardCheck className="w-5 h-5" />}
                    isSidebarOpen={isSidebarOpen}
                />
            )}

            <SidebarLink
                href={route("issued.qdn.index")}
                label="QDNs for My Department"
                icon={<Inbox className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
        </nav>
    );
}
