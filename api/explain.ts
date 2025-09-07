import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { message } = (req.body ?? {}) as { message?: string };
  if (!message) return res.status(400).json({ error: "Missing `message`" });

  // TODO: vervang dit door je echte AI-call
  return res.status(200).json({
    reply: `Ik heb je bericht: “${message}”. Wat is je eerstvolgende mini-doel?`,
  });
}
