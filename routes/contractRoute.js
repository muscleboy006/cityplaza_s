const express = require("express");
const router = express.Router();

const {
    getAllContractsNotArch,
    getAllContractsArch,
    addContract,
    getOneContract,
    updateContract,
    deleteContract,
    searchContracts,
    searchArchContracts,
    getStatistics,
    toggleArchive
} = require("../controllers/contractController");

// POST — создать контракт
router.post("/contracts", addContract);

// GET — получить все контракты
router.get("/contracts", getAllContractsNotArch);
router.get("/conarch", getAllContractsArch);

router.get("/contracts/:id", getOneContract);
// PUT — обновить контракт
router.put("/contracts/:id", updateContract);

// DELETE — удалить контракт
router.delete("/contracts/:id", deleteContract);

router.get("/search/contracts", searchContracts);
router.get("/search/archconts", searchArchContracts);

router.get("/stats", getStatistics);

router.patch("/:id/toggle", toggleArchive);


module.exports = router;