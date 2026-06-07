const router = require("express").Router();
const multer = require("multer");
const auth = require("../middleware/authMiddleware");
const { uploadCSV, getUploadHistory, resetAllTransactions } = require("../controllers/uploadController");

const upload = multer({
	dest: "uploads/",
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const isCsv = file.mimetype.includes("csv") || file.originalname.toLowerCase().endsWith(".csv");
		const isPdf = file.mimetype.includes("pdf") || file.originalname.toLowerCase().endsWith(".pdf");

		if (isCsv || isPdf) {
			cb(null, true);
			return;
		}

		cb(new Error("Only CSV and PDF statements are supported"));
	},
});

router.post("/", auth, upload.single("file"), uploadCSV);
router.get("/history", auth, getUploadHistory);
router.delete("/reset", auth, resetAllTransactions);

module.exports = router;