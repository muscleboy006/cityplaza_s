const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  createTax,
  getOneTax,
  getAllTax,
  updateTax,
  addPayment,
  getOnePayment,
  editPayment,
  deletePayment,
  deleteTax,
} = require("../controllers/taxController");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Роуты
router.post("/", createTax);
router.get("/", getAllTax);
router.get("/:id", getOneTax);
router.put("/:id", updateTax);
router.put("/:id/add-payment", upload.array("images", 15), addPayment);
router.get("/:id/payment/:paymentId", getOnePayment);
router.put("/:id/payment/:paymentId", upload.array("images", 15), editPayment);
router.delete("/:id/payment/:paymentId", deletePayment);
router.delete("/:id", deleteTax);

module.exports = router;