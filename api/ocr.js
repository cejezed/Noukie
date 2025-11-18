import express from "express";
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";
const router = express.Router();
// Multer in memory: veilig + snel
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
    fileFilter: (_req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.mimetype);
        cb(ok ? null : new Error("Ongeldig bestandsformaat"), ok);
    },
});
// POST /api/ocr  (form field: "image")
router.post("/ocr", upload.single("image"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "Geen afbeelding ontvangen" });
        // Preprocess: naar grijs PNG, contrast iets omhoog voor betere OCR
        const preprocessed = await sharp(req.file.buffer)
            .rotate() // auto-orient
            .grayscale()
            .normalize() // contrast/brightness normaliseren
            .toFormat("png")
            .toBuffer();
        // OCR: Nederlands + Engels (veel methodes bevatten Engelstalige termen)
        const { data } = await Tesseract.recognize(preprocessed, "nld+eng", {
            // Sneller/accurater: blokken en lijnen detecteren
            tessedit_char_whitelist: undefined,
        });
        const text = (data.text || "").trim();
        return res.json({
            text,
            // handige meta
            confidence: data.confidence,
            blocks: data.blocks?.length ?? 0,
            lines: data.lines?.length ?? 0,
        });
    }
    catch (err) {
        console.error("OCR error:", err);
        return res.status(500).json({ error: "OCR mislukt", details: err?.message });
    }
});
export default router;
