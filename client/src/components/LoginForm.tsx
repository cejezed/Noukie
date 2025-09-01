import { useState } from "react";
import { signIn, signUp, signOut } from "@/lib/auth";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fn = mode === "login" ? signIn : signUp;
      const { error } = await fn(email, password);
      if (error) setMessage(error.message);
      else setMessage("Succes! Je bent ingelogd.");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  return (
    <div>
      <h2>{mode === "login" ? "Inloggen" : "Registreren"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">
          {mode === "login" ? "Inloggen" : "Registreren"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        Wissel naar {mode === "login" ? "registreren" : "inloggen"}
      </button>
      <button onClick={() => signOut()}>Uitloggen</button>
      {message && <p>{message}</p>}
    </div>
  );
}
