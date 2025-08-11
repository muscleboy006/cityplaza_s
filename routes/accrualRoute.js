const express = require("express");
const router = express.Router();

const accrualsController = require("../controllers/accrualController");

// POST — создать начисление
router.post("/accruals", accrualsController.createAccrual);

// GET /accruals/check/:contractId — проверить доступную сумму (должен быть ДО /:id)
router.get("/check/:contractId", accrualsController.checkAvailableAmount);

// GET — получить все начисления
router.get("/accruals", accrualsController.getAllAccruals);
router.get("/accruals/:id", accrualsController.getOneAccrual);


// PUT — обновить начисление
router.put("/accruals/:id", accrualsController.updateAccrual);

// DELETE — удалить начисление
router.delete("/accruals/:id", accrualsController.deleteAccrual);

module.exports = router;