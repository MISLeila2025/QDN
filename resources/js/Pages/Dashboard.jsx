import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";

export default function Dashboard() {
    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <h1 className="text-2xl font-bold">Dashboard</h1>
        </AuthenticatedLayout>
    );
}
