// controllers/contractsController.js
const Accrual = require("../models/Accrual");
const Contract = require("../models/Contracts");

// GET /contracts — получить список контрактов с лимитом и пагинацией
const getAllContracts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const contracts = await Contract.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contracts,
      pagination: { page, limit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error.message,
    });
  }
};

const getOneContract = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Все начисления (без пагинации)
    const allAccruals = await Accrual.find({ contractId: req.params.id })
      .sort({ year: 1, month: 1, createdAt: 1 });

    // Пагинированные начисления
    const accruals = await Accrual.find({ contractId: req.params.id })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Общая сумма платежей
    const totalPayments = allAccruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);

    // ===== Новая система начислений по дням =====
    function daysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }

    function calculateAccrual(moveInDate, moveOutDate, monthlyAmount) {
      if (!moveInDate) return 0;

      const today = new Date();
      const start = new Date(moveInDate);
      const end = moveOutDate ? new Date(moveOutDate) : today;

      if (end < start) return 0;

      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return ((end.getDate() - start.getDate() + 1) / daysInMonth(start.getFullYear(), start.getMonth())) * monthlyAmount;
      }

      const fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) - 1;

      const firstMonthDays = daysInMonth(start.getFullYear(), start.getMonth());
      const firstMonthAccrual = ((firstMonthDays - start.getDate() + 1) / firstMonthDays) * monthlyAmount;

      const lastMonthDays = daysInMonth(end.getFullYear(), end.getMonth());
      const lastMonthAccrual = (end.getDate() / lastMonthDays) * monthlyAmount;

      return firstMonthAccrual + (fullMonths > 0 ? fullMonths * monthlyAmount : 0) + lastMonthAccrual;
    }

    const totalAccruals = calculateAccrual(
      contract.moveInDate,
      contract.moveOutDate,
      contract.contractAmountMinus12 || 0
    );

    const debt = totalAccruals - totalPayments;

    // Отправляем только общие данные, без помесячных долгов
    res.status(200).json({
      success: true,
      data: {
        contract,
        accruals, // чистые платежи
        totalAccruals,
        totalPayments,
        debt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contract",
      error: error.message,
    });
  }
};



const addContract = async (req, res) => {
  try {
    const contract = await Contract.create(req.body);
    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create contract",
      error: error.message,
    });
  }
};

// PUT /contracts/:id — обновить контракт
const updateContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update contract",
      error: error.message,
    });
  }
};

// DELETE /contracts/:id — удалить контракт
const deleteContract = async (req, res) => {
  try {
    // Сначала удаляем все начисления, связанные с контрактом
    await Accrual.deleteMany({ contractId: req.params.id });

    // Потом удаляем сам контракт
    const deletedContract = await Contract.findByIdAndDelete(req.params.id);

    if (!deletedContract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    res.status(200).json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete contract",
      error: error.message,
    });
  }
};


// GET /contracts/search — поиск контрактов по названию компании
const searchContracts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchRegex = new RegExp(query, "i"); // i — регистронезависимый поиск

    const contracts = await Contract.find({
      company: searchRegex // Поиск только по названию компании
    })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contracts,
      total: contracts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search contracts",
      error: error.message,
    });
  }
};

// GET /contracts/statistics?year=2025&month=8
// const getStatistics = async (req, res) => {
//   try {
//     const { year, month } = req.query;

//     // Общая площадь здания (задаём вручную или тянем из БД)
//     const totalBuildingArea = 1000; // м² (поставь свою цифру)

//     // Фильтр по начислениям
//     let accrualFilter = {};
//     if (year) accrualFilter.year = Number(year);
//     if (month) accrualFilter.month = Number(month); // если у тебя месяц хранится как число

//     // Получаем все начисления с фильтром
//     const accruals = await Accrual.find(accrualFilter);

//     const totalAccrualsAmount = accruals.reduce((sum, a) => sum + (a.accrualAmount || 0), 0);
//     const totalPaymentsAmount = accruals.reduce((sum, a) => sum + (a.paymentAmount || 0), 0); // если есть поле paymentAmount
//     const totalDebt = totalAccrualsAmount - totalPaymentsAmount;

//     // Занятость здания
//     const activeContractsFilter = {
//       $or: [
//         { moveOutDate: null },
//         { moveOutDate: { $gte: new Date() } }
//       ]
//     };
//     const activeContracts = await Contract.find(activeContractsFilter);

//     const occupiedArea = activeContracts.reduce((sum, c) => {
//       const numericArea = parseFloat(c.area); // "24 м²" → 24
//       return sum + (isNaN(numericArea) ? 0 : numericArea);
//     }, 0);

//     const occupancyPercent = totalBuildingArea > 0
//       ? ((occupiedArea / totalBuildingArea) * 100).toFixed(2)
//       : 0;

//     res.json({
//       success: true,
//       data: {
//         year: year ? Number(year) : "all",
//         month: month ? Number(month) : "all",
//         totalDebt,
//         totalPayments: totalPaymentsAmount,
//         occupancy: {
//           occupiedArea,
//           totalBuildingArea,
//           occupancyPercent
//         }
//       }
//     });

//   } catch (error) {
//     console.error("Ошибка при получении статистики:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch statistics",
//       error: error.message
//     });
//   }
// };

const getStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;

    // Общая площадь здания (можно вынести в ENV или БД)
    const totalBuildingArea = 1000; // м²

    // ---------- 1. Общий долг ----------
    const allAccruals = await Accrual.find({});
    const totalAccrualsAmount = allAccruals.reduce(
      (sum, a) => sum + (a.accrualAmount || 0),
      0
    );
    const totalPaymentsAmountAll = allAccruals.reduce(
      (sum, a) => sum + (a.paymentAmount || 0),
      0
    );
    const totalDebt = totalAccrualsAmount - totalPaymentsAmountAll;

    // ---------- 2. Платежи за период ----------
    let accrualFilter = {};
    if (year) {
      const y = Number(year);

      let startDate = new Date(`${y}-01-01T00:00:00.000Z`);
      let endDate;

      if (month) {
        // Если указан год + месяц → считаем до конца месяца включительно
        const m = Number(month);
        endDate = new Date(y, m, 0, 23, 59, 59, 999); // последний день месяца
      } else {
        // Если только год → берём весь год до декабря
        endDate = new Date(y, 12, 31, 23, 59, 59, 999);
      }

      accrualFilter.date = { $gte: startDate, $lte: endDate };
    }

    const accrualsThisPeriod = await Accrual.find(accrualFilter);
    const totalPaymentsThisPeriod = accrualsThisPeriod.reduce(
      (sum, a) => sum + (a.paymentAmount || 0),
      0
    );

    // ---------- 3. Занятость здания ----------
    const activeContractsFilter = {
      $or: [{ moveOutDate: null }, { moveOutDate: { $gte: new Date() } }],
    };
    const activeContracts = await Contract.find(activeContractsFilter);

    const occupiedArea = activeContracts.reduce((sum, c) => {
      const numericArea = parseFloat(c.area); // "24 м²" → 24
      return sum + (isNaN(numericArea) ? 0 : numericArea);
    }, 0);

    const occupancyPercent =
      totalBuildingArea > 0
        ? ((occupiedArea / totalBuildingArea) * 100).toFixed(2)
        : 0;

    // ---------- Ответ ----------
    res.json({
      success: true,
      data: {
        year: year ? Number(year) : "all",
        month: month ? Number(month) : "all",
        totalDebt,
        totalPaymentsThisPeriod,
        occupancy: {
          occupiedArea,
          totalBuildingArea,
          occupancyPercent,
        },
      },
    });
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};



module.exports = {
  getAllContracts,
  getOneContract,
  addContract,
  updateContract,
  deleteContract,
  searchContracts,
  getStatistics
};