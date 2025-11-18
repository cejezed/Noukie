import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { signIn, signUp, signOut } from "@/lib/auth";
export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState("login");
    const [message, setMessage] = useState("");
    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const fn = mode === "login" ? signIn : signUp;
            const { error } = await fn(email, password);
            if (error)
                setMessage(error.message);
            else
                setMessage("Succes! Je bent ingelogd.");
        }
        catch (e) {
            setMessage(e.message);
        }
    }
    return (_jsxs("div", { children: [_jsx("h2", { children: mode === "login" ? "Inloggen" : "Registreren" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsx("input", { type: "email", placeholder: "E-mail", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("input", { type: "password", placeholder: "Wachtwoord", value: password, onChange: (e) => setPassword(e.target.value) }), _jsx("button", { type: "submit", children: mode === "login" ? "Inloggen" : "Registreren" })] }), _jsxs("button", { onClick: () => setMode(mode === "login" ? "signup" : "login"), children: ["Wissel naar ", mode === "login" ? "registreren" : "inloggen"] }), _jsx("button", { onClick: () => signOut(), children: "Uitloggen" }), message && _jsx("p", { children: message })] }));
}
