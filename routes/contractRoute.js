const express = require("express");
const router = express.Router();

const {
    getAllContracts,
    getOneContract,
    addContract,
    updateContract,
    deleteContract,
    searchContracts
} = require("../controllers/contractController");

// POST — создать контракт
router.post("/contracts", addContract);

// GET — получить все контракты
router.get("/contracts", getAllContracts);

// GET — получить контракт по ID
router.get("/contracts/:id", getOneContract);

// PUT — обновить контракт
router.put("/contracts/:id", updateContract);

// DELETE — удалить контракт
router.delete("/contracts/:id", deleteContract);

router.get("/search/contracts", searchContracts);


module.exports = router;