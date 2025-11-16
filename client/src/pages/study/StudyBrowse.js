import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
async function getUid() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}
export default function StudyBrowse() {
    const [userId, setUserId] = useState(null);
    const [, navigate] = useLocation();
    useEffect(() => {
        getUid().then(setUserId);
    }, []);
    const quizzes = useQuery({
        queryKey: ["quizzes", userId],
        enabled: !!userId,
        queryFn: async () => {
            const res = await fetch("/api/quizzes", {
                headers: { "x-user-id": userId },
            });
            if (!res.ok)
                throw new Error(await res.text());
            const json = await res.json();
            // Alleen gepubliceerde quizzes tonen
            return json.data.filter((q) => q.is_published);
        },
    });
    if (!userId) {
        return (_jsx("main", { className: "mx-auto max-w-[1000px] px-6 py-8", children: _jsx("p", { className: "text-sm text-gray-500", children: "Inloggen vereist\u2026" }) }));
    }
    if (quizzes.isLoading) {
        return (_jsx("main", { className: "mx-auto max-w-[1000px] px-6 py-8", children: _jsx("p", { children: "Laden\u2026" }) }));
    }
    if (quizzes.isError) {
        return (_jsx("main", { className: "mx-auto max-w-[1000px] px-6 py-8", children: _jsx("p", { className: "text-red-600", children: "Er ging iets mis bij het laden van de quizzes." }) }));
    }
    return (_jsxs("main", { className: "mx-auto max-w-[1000px] px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-semibold mb-6", children: "Toetsen" }), quizzes.data?.length ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: quizzes.data.map((q) => (_jsxs("button", { onClick: () => navigate(`/toets/spelen?quiz=${q.id}`), className: "text-left bg-white rounded-2xl shadow p-4 hover:shadow-md", children: [_jsxs("div", { className: "text-sm text-gray-500", children: [q.subject, " \u00B7 ", q.chapter] }), _jsx("div", { className: "font-semibold", children: q.title }), q.description && (_jsx("div", { className: "text-sm text-gray-600 line-clamp-2", children: q.description }))] }, q.id))) })) : (_jsx("p", { className: "text-gray-600", children: "Nog geen gepubliceerde toetsen." }))] }));
}
