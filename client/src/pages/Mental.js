import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from "@/lib/auth";
import MentalCheckin from "@/features/mental/MentalCheckin";
export default function Mental() {
    const { user, loading } = useAuth();
    console.log('Mental page - user:', user); // Debug log
    console.log('Mental page - loading:', loading); // Debug log
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx("div", { className: "animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" }) }));
    }
    if (!user) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Niet ingelogd" }), _jsx("p", { className: "text-gray-600", children: "Log eerst in om verder te gaan." })] }) }));
    }
    return (_jsx("div", { className: "container mx-auto p-4", children: _jsx(MentalCheckin, { userId: user.id }) }));
}
