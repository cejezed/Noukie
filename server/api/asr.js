import multer from "multer";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});
export default function registerAsrRoute(router) {
    router.post("/api/asr", upload.single("audio"), async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ error: "No audio file" });
            if (!process.env.OPENAI_API_KEY)
                return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
            // Bouw multipart body met Node's globale FormData/Blob
            const form = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
            form.append("file", blob, req.file.originalname || "voice.webm");
            form.append("model", "gpt-4o-transcribe"); // of "whisper-1" als je dat wilt
            form.append("language", req.body?.lang || "nl");
            const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
                body: form,
            });
            const txt = await r.text();
            if (!r.ok)
                return res.status(r.status).type("text/plain").send(txt);
            const data = JSON.parse(txt);
            return res.json({ text: data.text || "" });
        }
        catch (e) {
            return res.status(500).json({ error: e?.message || "ASR failed" });
        }
    });
}
