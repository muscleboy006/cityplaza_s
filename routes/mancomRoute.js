const express = require("express");
const router = express.Router();
const {
  getAllMancom,
  getOneMancom,
  addMancom,
  editMancom,
  delMancom
} = require("../controllers/mancomController");

// ✅ Получить расчет по компаниям + все записи
router.get("/", getAllMancom);

// ✅ Получить одну запись по ID
router.get("/:id", getOneMancom);

// ✅ Добавить запись
router.post("/", addMancom);

// ✅ Обновить запись
router.put("/:id", editMancom);

// ✅ Удалить запись
router.delete("/:id", delMancom);

module.exports = router;