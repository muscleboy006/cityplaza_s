const express = require("express");
const router = express.Router();
const {
  getAllMancom,
  getOneMancom,
  addMancom,
  editMancom,
  delMancom,
  getDebtMancom
} = require("../controllers/mancomController");

// ✅ Получить расчет по компаниям + все записи
router.get("/", getAllMancom);

// ✅ Получить одну запись по ID
router.get("/debt", getDebtMancom);
router.get("/:id", getOneMancom);

// ✅ Добавить запись
router.post("/", addMancom);

// ✅ Обновить запись
router.put("/:id", editMancom);

// ✅ Удалить запись
router.delete("/:id", delMancom);

module.exports = router;