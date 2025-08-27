const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  createElectrcy,
  getOneElectrcy,
  getAllElectrcy,
  updateElectrcy,
  getAllContracts,
  addPayment,
  getOnePayment,
  editPayment,
  deletePayment,
  deleteElectrcy,
} = require("../controllers/electrcyController");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Роуты
router.post("/", createElectrcy);
router.get("/", getAllElectrcy);
router.get("/cons", getAllContracts);
router.get("/:id", getOneElectrcy);
router.put("/:id", updateElectrcy);
router.put("/:id/add-payment", upload.array("images", 15), addPayment);
router.get("/:id/payment/:paymentId", getOnePayment);
router.put("/:id/payment/:paymentId", upload.array("images", 15), editPayment);
router.delete("/:id/payment/:paymentId", deletePayment);
router.delete("/:id", deleteElectrcy);

module.exports = router;