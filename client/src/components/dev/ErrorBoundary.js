import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error("UI error:", error, info); }
    render() {
        if (this.state.error) {
            return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-semibold text-red-600", children: "Er ging iets mis" }), _jsx("pre", { className: "mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto", children: String(this.state.error?.message || this.state.error) })] }));
        }
        return this.props.children;
    }
}
